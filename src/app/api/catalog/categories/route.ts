import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  const activeOnly = !auth.authenticated

  try {
    const params: unknown[] = []
    let where = ""
    if (activeOnly) {
      where = "WHERE is_active = true"
    }

    const result = await query(
      `SELECT id, name, slug, description, image_url, sort_order, is_active,
              featured_on_home, parent_id, created_at
       FROM categories
       ${where}
       ORDER BY sort_order ASC, name ASC`,
      params,
    )
    return NextResponse.json(result.rows)
  } catch (err: unknown) {
    console.error("[catalog/categories GET]", err)
    return NextResponse.json({ error: "Failed to list categories" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    slug,
    description,
    image_url,
    is_active = true,
    sort_order = 0,
    featured_on_home = false,
    parent_id = null,
  } = body

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 })
  }

  try {
    const created = await queryOne(
      `INSERT INTO categories (name, slug, description, image_url, is_active, sort_order, featured_on_home, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid)
       RETURNING *`,
      [
        name,
        slug,
        description || null,
        image_url || null,
        Boolean(is_active),
        Number(sort_order) || 0,
        Boolean(featured_on_home),
        parent_id || null,
      ],
    )
    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
