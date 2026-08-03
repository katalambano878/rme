import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("chat_conversations"))) {
    return NextResponse.json({ data: [], total: 0, message: "Support tables not configured" }, { status: 501 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const search = searchParams.get("search") || ""
  const sentiment = searchParams.get("sentiment") || ""
  const category = searchParams.get("category") || ""
  const resolved = searchParams.get("resolved") || ""
  const offset = (page - 1) * limit

  const params: unknown[] = []
  const where: string[] = []
  let i = 1

  if (search) {
    params.push(`%${search}%`)
    where.push(
      `(customer_email ILIKE $${i} OR customer_name ILIKE $${i} OR summary ILIKE $${i} OR session_id ILIKE $${i})`,
    )
    i++
  }
  if (sentiment) {
    where.push(`sentiment = $${i}`)
    params.push(sentiment)
    i++
  }
  if (category) {
    where.push(`category = $${i}`)
    params.push(category)
    i++
  }
  if (resolved === "true") where.push(`is_resolved = true`)
  if (resolved === "false") where.push(`(is_resolved = false OR is_resolved IS NULL)`)
  if (resolved === "escalated") where.push(`is_escalated = true`)

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  params.push(limit, offset)

  try {
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM chat_conversations ${whereSql}`,
      params.slice(0, -2),
    )
    const result = await query(
      `SELECT * FROM chat_conversations ${whereSql} ORDER BY updated_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      params,
    )
    return NextResponse.json({ data: result.rows, total: Number(countRow?.count || 0), page, limit })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [], total: 0 }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("chat_conversations"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

  const allowed = [
    "is_resolved",
    "is_escalated",
    "sentiment",
    "category",
    "summary",
    "assigned_to",
    "notes",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let j = 2

  for (const key of allowed) {
    if (key in updates) {
      if (key === "assigned_to") {
        sets.push(`${key} = $${j}::uuid`)
        params.push(updates[key] || null)
      } else {
        sets.push(`${key} = $${j}`)
        params.push(updates[key])
      }
      j++
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: "No fields" }, { status: 400 })
  }

  sets.push("updated_at = now()")

  try {
    const data = await queryOne(
      `UPDATE chat_conversations SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
      params,
    )
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
