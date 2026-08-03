import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_knowledge_base"))) {
    return NextResponse.json({ data: [], message: "Knowledge base not configured" }, { status: 501 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const category = searchParams.get("category") || ""
  const published = searchParams.get("published")

  const params: unknown[] = []
  const where: string[] = []
  let i = 1

  if (search) {
    params.push(`%${search}%`)
    where.push(`(title ILIKE $${i} OR content ILIKE $${i})`)
    i++
  }
  if (category) {
    where.push(`category = $${i}`)
    params.push(category)
    i++
  }
  if (published === "true") where.push(`is_published = true`)
  if (published === "false") where.push(`is_published = false`)

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

  try {
    const result = await query(
      `SELECT * FROM support_knowledge_base ${whereSql} ORDER BY updated_at DESC`,
      params,
    )
    return NextResponse.json({ data: result.rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_knowledge_base"))) {
    return NextResponse.json({ error: "Knowledge base not configured" }, { status: 501 })
  }

  const body = await req.json()
  try {
    const data = await queryOne(
      `INSERT INTO support_knowledge_base (
         title, content, category, tags, source, source_ticket_id, is_published, created_by
       ) VALUES ($1, $2, $3, $4::text[], $5, $6::uuid, $7, $8)
       RETURNING *`,
      [
        body.title,
        body.content,
        body.category || null,
        Array.isArray(body.tags) ? body.tags : [],
        body.source || "manual",
        body.source_ticket_id || null,
        body.is_published ?? true,
        body.created_by || "admin",
      ],
    )
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_knowledge_base"))) {
    return NextResponse.json({ error: "Knowledge base not configured" }, { status: 501 })
  }

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

  const allowed = ["title", "content", "category", "tags", "is_published", "source"] as const
  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in updates) {
      if (key === "tags") {
        sets.push(`${key} = $${i}::text[]`)
        params.push(Array.isArray(updates[key]) ? updates[key] : [])
      } else {
        sets.push(`${key} = $${i}`)
        params.push(updates[key])
      }
      i++
    }
  }

  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 })
  sets.push("updated_at = now()")

  try {
    const data = await queryOne(
      `UPDATE support_knowledge_base SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
      params,
    )
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_knowledge_base"))) {
    return NextResponse.json({ error: "Knowledge base not configured" }, { status: 501 })
  }

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

  try {
    await query(`DELETE FROM support_knowledge_base WHERE id = $1::uuid`, [id])
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
