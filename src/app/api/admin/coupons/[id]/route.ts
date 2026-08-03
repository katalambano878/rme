import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()

  const allowed = [
    "code",
    "description",
    "discount_type",
    "value",
    "min_spend",
    "max_uses",
    "starts_at",
    "ends_at",
    "is_active",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      if (key === "starts_at" || key === "ends_at") {
        sets.push(`${key} = $${i}::timestamptz`)
        params.push(body[key] || null)
      } else if (key === "code") {
        sets.push(`${key} = $${i}`)
        params.push(String(body[key]).trim().toUpperCase())
      } else {
        sets.push(`${key} = $${i}`)
        params.push(body[key])
      }
      i++
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: "No fields" }, { status: 400 })
  }

  const row = await queryOne(`UPDATE discounts SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`, params)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(row)
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const result = await query(`DELETE FROM discounts WHERE id = $1::uuid RETURNING id`, [id])
  if (!result.rowCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
