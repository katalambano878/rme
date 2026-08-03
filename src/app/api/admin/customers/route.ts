import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (id) {
    try {
      const profile = await queryOne(
        `SELECT id, email, full_name, phone, role, avatar_url, created_at, updated_at
         FROM profiles WHERE id = $1::uuid LIMIT 1`,
        [id],
      )
      if (!profile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      const orders = await query(
        `SELECT id, order_number, status, grand_total, created_at, shipping_address, guest_email
         FROM orders
         WHERE user_id = $1::uuid OR guest_email = $2
         ORDER BY created_at DESC`,
        [id, profile.email],
      )

      return NextResponse.json({ profile, orders: orders.rows })
    } catch (err: unknown) {
      console.error("[admin/customers GET id]", err)
      return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
    }
  }

  try {
    const profilesResult = await query(
      `SELECT id, email, full_name, phone, role, avatar_url, created_at, updated_at
       FROM profiles
       WHERE role = 'customer'
       ORDER BY created_at DESC`,
    )

    const ordersResult = await query<{
      id: string
      user_id: string | null
      guest_email: string | null
      grand_total: string | number | null
      created_at: string
      status: string | null
      shipping_address: Record<string, unknown> | null
    }>(
      `SELECT id, user_id, guest_email, grand_total, created_at, status, shipping_address
       FROM orders
       ORDER BY created_at DESC
       LIMIT 5000`,
    )

    return NextResponse.json({
      profiles: profilesResult.rows,
      orders: ordersResult.rows,
    })
  } catch (err: unknown) {
    console.error("[admin/customers GET]", err)
    return NextResponse.json({ error: "Failed to list customers" }, { status: 500 })
  }
}
