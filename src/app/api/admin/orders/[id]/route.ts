import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { getOrderByIdAdmin } from "@/lib/data/orders-admin"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  try {
    const order = await getOrderByIdAdmin(id)
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (err: unknown) {
    console.error("[admin/orders/[id] GET]", err)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()

  const allowed = ["status", "notes", "shipping_address", "billing_address"] as const
  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      if (key === "status") {
        sets.push(`${key} = $${i}::order_status`)
        params.push(body[key])
      } else if (key === "shipping_address" || key === "billing_address") {
        sets.push(`${key} = $${i}::jsonb`)
        params.push(JSON.stringify(body[key]))
      } else {
        sets.push(`${key} = $${i}`)
        params.push(body[key])
      }
      i++
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  if (body.status === "shipped" || body.status === "delivered" || body.status === "out_for_delivery") {
    const current = await queryOne<{ paid: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE (o.id::text = $1 OR o.order_number = $1) AND p.status = 'paid'
       ) AS paid`,
      [id],
    )
    const order = await queryOne<{ notes: string | null; guest_email: string | null }>(
      `SELECT notes, guest_email FROM orders WHERE id::text = $1 OR order_number = $1 LIMIT 1`,
      [id],
    )
    const notes = (order?.notes || "").toLowerCase()
    const isPos =
      notes.includes("pos sale") ||
      notes.includes("pos checkout") ||
      (order?.guest_email || "").toLowerCase() === "pos-walkin@store.local"

    if (!current?.paid && !isPos) {
      return NextResponse.json(
        { error: "Order must be paid before advancing to fulfillment status" },
        { status: 400 },
      )
    }
  }

  sets.push("updated_at = now()")

  try {
    const updated = await queryOne(
      `UPDATE orders SET ${sets.join(", ")}
       WHERE id::text = $1 OR order_number = $1
       RETURNING *`,
      params,
    )
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
