import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const row = await queryOne(`SELECT * FROM blog_posts WHERE id = $1::uuid OR slug = $1 LIMIT 1`, [id])
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(row)
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()

  const allowed = [
    "title",
    "slug",
    "excerpt",
    "body",
    "cover_image_url",
    "category",
    "published",
    "published_at",
    "read_time_minutes",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      if (key === "published_at") {
        sets.push(`${key} = $${i}::timestamptz`)
        params.push(body[key] || null)
      } else {
        sets.push(`${key} = $${i}`)
        params.push(body[key])
      }
      i++
    }
  }

  if ("content" in body && !("body" in body)) {
    sets.push(`body = $${i}`)
    params.push(body.content)
    i++
  }

  if (!sets.length) {
    return NextResponse.json({ error: "No fields" }, { status: 400 })
  }

  sets.push("updated_at = now()")

  const row = await queryOne(
    `UPDATE blog_posts SET ${sets.join(", ")} WHERE id = $1::uuid OR slug = $1 RETURNING *`,
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
  const result = await query(`DELETE FROM blog_posts WHERE id = $1::uuid OR slug = $1 RETURNING id`, [id])
  if (!result.rowCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
