import { NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { listOrdersAdmin } from "@/lib/data/orders-admin"
import { reduceOrderStock } from "@/lib/order-stock"
import { generateOrderNumber } from "@/lib/utils"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || undefined
  const search = searchParams.get("q") || searchParams.get("search") || undefined
  const limitRaw = searchParams.get("limit")
  const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 5000, 5000) : undefined

  try {
    const orders = await listOrdersAdmin({ status, search, limit })
    return NextResponse.json(orders)
  } catch (err: unknown) {
    console.error("[admin/orders GET]", err)
    return NextResponse.json({ error: "Failed to list orders" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 })
    }

    const orderNumber = body.order_number || generateOrderNumber()
    const paymentMethod = String(body.payment_method || "cash")
    const isInPersonPayment = ["cash", "card", "momo"].includes(paymentMethod)
    const grandTotal = Number(body.grand_total) || 0

    const order = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO orders (
           order_number, user_id, guest_email, guest_phone, status, currency,
           subtotal, tax_total, shipping_total, discount_total, grand_total,
           shipping_address, billing_address, notes
         ) VALUES (
           $1, $2::uuid, $3, $4, $5::order_status, $6,
           $7, $8, $9, $10, $11,
           $12::jsonb, $13::jsonb, $14
         ) RETURNING *`,
        [
          orderNumber,
          body.user_id || null,
          body.guest_email || null,
          body.guest_phone || null,
          isInPersonPayment ? "processing" : "pending",
          body.currency || "GHS",
          Number(body.subtotal) || 0,
          Number(body.tax_total) || 0,
          Number(body.shipping_total) || 0,
          Number(body.discount_total) || 0,
          grandTotal,
          JSON.stringify(body.shipping_address || {}),
          JSON.stringify(body.billing_address || body.shipping_address || {}),
          body.notes || null,
        ],
      )
      const row = inserted.rows[0]
      if (!row) throw new Error("Order insert failed")

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, variant_id, name_snapshot, sku_snapshot,
             quantity, unit_price, line_total
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8
           )`,
          [
            row.id,
            item.product_id || null,
            item.variant_id || null,
            item.name_snapshot || item.name || "Item",
            item.sku_snapshot || item.sku || null,
            Number(item.quantity) || 1,
            Number(item.unit_price) || 0,
            Number(item.line_total) || 0,
          ],
        )
      }

      if (isInPersonPayment) {
        const paymentRef = `POS-${paymentMethod.toUpperCase()}-${Date.now()}`
        await client.query(
          `INSERT INTO payments (order_id, provider, amount, currency, status, provider_ref)
           VALUES ($1::uuid, $2, $3, $4, 'paid', $5)`,
          [row.id, paymentMethod, grandTotal, body.currency || "GHS", paymentRef],
        )
      }

      return row
    })

    if (isInPersonPayment) {
      try {
        await reduceOrderStock(String(order.id))
      } catch (stockErr) {
        console.error("[admin/orders POST] stock reduction:", stockErr)
      }
    }

    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    console.error("[admin/orders POST]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
