import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

const DISCOUNT_TYPES = ["percent", "fixed", "free_shipping"] as const
type DiscountType = (typeof DISCOUNT_TYPES)[number]

function isDiscountType(v: unknown): v is DiscountType {
  return typeof v === "string" && (DISCOUNT_TYPES as readonly string[]).includes(v)
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await query(`SELECT * FROM discounts ORDER BY created_at DESC`)
    return NextResponse.json(result.rows)
  } catch (err: unknown) {
    console.error("[admin/coupons GET]", err)
    return NextResponse.json({ error: "Failed to list coupons" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    code,
    description,
    discount_type,
    value,
    min_spend = 0,
    max_uses = null,
    starts_at = null,
    ends_at = null,
    is_active = true,
  } = body

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 })
  }
  if (!isDiscountType(discount_type)) {
    return NextResponse.json({ error: "discount_type must be percent, fixed, or free_shipping" }, { status: 400 })
  }

  const normalizedCode = code.trim().toUpperCase()

  try {
    const created = await queryOne(
      `INSERT INTO discounts (
        code, description, discount_type, value, min_spend, max_uses,
        starts_at, ends_at, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9
      ) RETURNING *`,
      [
        normalizedCode,
        description || null,
        discount_type,
        value != null ? Number(value) : null,
        Number(min_spend) || 0,
        max_uses != null && max_uses !== "" ? Number(max_uses) : null,
        starts_at || null,
        ends_at || null,
        Boolean(is_active),
      ],
    )
    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    if (message.includes("discounts_code_key") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 })
    }
    console.error("[admin/coupons POST]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
