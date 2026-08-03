import { NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    orderNumber,
    customerEmail,
    customerPhone,
    paymentMethod = "cash",
    deliveryMethod = "pickup",
    cart = [],
    addressData = {},
    subtotal,
    tax = 0,
    grandTotal,
  } = body

  if (!orderNumber || !Array.isArray(cart) || !cart.length) {
    return NextResponse.json({ error: "Invalid POS payload" }, { status: 400 })
  }

  const isInPersonPayment = ["cash", "card", "momo"].includes(paymentMethod)
  const email = customerEmail || "pos-walkin@store.local"
  const phone = customerPhone || null
  const total = Number(grandTotal ?? subtotal ?? 0)
  const taxTotal = Number(tax) || 0
  const cartSubtotal = Number(subtotal ?? total - taxTotal)

  try {
    const order = await withTransaction(async (client) => {
      const orderRes = await client.query(
        `INSERT INTO orders (
           order_number, user_id, guest_email, guest_phone, status, currency,
           subtotal, tax_total, shipping_total, discount_total, grand_total,
           shipping_address, billing_address, notes
         ) VALUES (
           $1, NULL, $2, $3, $4::order_status, 'GHS',
           $5, $6, 0, 0, $7, $8::jsonb, $9::jsonb, $10
         ) RETURNING *`,
        [
          orderNumber,
          email,
          phone,
          isInPersonPayment ? "processing" : "pending",
          cartSubtotal,
          taxTotal,
          total,
          JSON.stringify(addressData),
          JSON.stringify(addressData),
          `POS sale — ${deliveryMethod}`,
        ],
      )
      const created = orderRes.rows[0]

      for (const item of cart) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, line_total
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`,
          [
            created.id,
            item.id,
            item.name,
            item.sku || null,
            item.cartQuantity || item.quantity || 1,
            item.price,
            (item.price || 0) * (item.cartQuantity || item.quantity || 1),
          ],
        )
      }

      if (isInPersonPayment) {
        const paymentRef = `POS-${String(paymentMethod).toUpperCase()}-${Date.now()}`
        await client.query(
          `INSERT INTO payments (order_id, provider, amount, currency, status, provider_ref)
           VALUES ($1::uuid, $2, $3, 'GHS', 'paid'::payment_status, $4)`,
          [created.id, paymentMethod, total, paymentRef],
        )
      }

      return created
    })

    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "POS checkout failed"
    console.error("[admin/pos/checkout]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
