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
    "name",
    "slug",
    "description",
    "image_url",
    "is_active",
    "sort_order",
    "featured_on_home",
    "parent_id",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      if (key === "parent_id") {
        sets.push(`${key} = $${i}::uuid`)
        params.push(body[key] || null)
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

  const row = await queryOne(
    `UPDATE categories SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
    params,
  )
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
  await query(`UPDATE products SET category_id = NULL WHERE category_id = $1::uuid`, [id])
  await query(`UPDATE categories SET parent_id = NULL WHERE parent_id = $1::uuid`, [id])
  await query(`DELETE FROM categories WHERE id = $1::uuid`, [id])
  return NextResponse.json({ success: true })
}
