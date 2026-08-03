import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_tickets"))) {
    return NextResponse.json(
      { data: [], total: 0, page: 1, limit: 20, message: "Support tables not configured" },
      { status: 501 },
    )
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const status = searchParams.get("status") || ""
  const priority = searchParams.get("priority") || ""
  const search = searchParams.get("search") || ""
  const offset = (page - 1) * limit

  const params: unknown[] = []
  const where: string[] = []
  let i = 1

  if (status) {
    where.push(`status = $${i}`)
    params.push(status)
    i++
  }
  if (priority) {
    where.push(`priority = $${i}`)
    params.push(priority)
    i++
  }
  if (search) {
    params.push(`%${search}%`)
    where.push(
      `(ticket_number ILIKE $${i} OR subject ILIKE $${i} OR customer_email ILIKE $${i} OR customer_name ILIKE $${i})`,
    )
    i++
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  params.push(limit, offset)

  try {
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM support_tickets ${whereSql}`,
      params.slice(0, -2),
    )
    const result = await query(
      `SELECT * FROM support_tickets ${whereSql} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      params,
    )
    return NextResponse.json({
      data: result.rows,
      total: Number(countRow?.count || 0),
      page,
      limit,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [], total: 0 }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_tickets"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const body = await req.json()
  const ticketNum = `TKT-${Date.now()}`
  const priority = body.priority || "medium"
  const slaDeadline =
    priority === "urgent"
      ? new Date(Date.now() + 4 * 3600000).toISOString()
      : priority === "high"
        ? new Date(Date.now() + 8 * 3600000).toISOString()
        : new Date(Date.now() + 24 * 3600000).toISOString()

  try {
    const ticket = await queryOne(
      `INSERT INTO support_tickets (
         ticket_number, subject, description, customer_id, customer_email, customer_name,
         conversation_id, status, priority, category, channel, assigned_to, tags, sla_deadline
       ) VALUES (
         $1, $2, $3, $4::uuid, $5, $6, $7::uuid, $8, $9, $10, $11, $12::uuid, $13::text[], $14::timestamptz
       ) RETURNING *`,
      [
        ticketNum,
        body.subject,
        body.description || "",
        body.customer_id || null,
        body.customer_email || "",
        body.customer_name || "",
        body.conversation_id || null,
        body.status || "open",
        priority,
        body.category || null,
        body.channel || "manual",
        body.assigned_to || null,
        Array.isArray(body.tags) ? body.tags : [],
        slaDeadline,
      ],
    )

    if (body.initial_message && ticket && (await tableExists("support_ticket_messages"))) {
      await query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_name, content)
         VALUES ($1::uuid, $2, $3, $4)`,
        [
          ticket.id,
          body.message_sender_type || "system",
          body.message_sender_name || "System",
          body.initial_message,
        ],
      )
    }

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_tickets"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "Ticket ID required" }, { status: 400 })

  if (updates.status === "resolved" && !updates.resolved_at) {
    updates.resolved_at = new Date().toISOString()
  }
  if (updates.status === "closed" && !updates.closed_at) {
    updates.closed_at = new Date().toISOString()
  }

  const allowed = [
    "status",
    "priority",
    "assigned_to",
    "category",
    "tags",
    "resolved_at",
    "closed_at",
    "subject",
    "description",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in updates) {
      if (key === "assigned_to") {
        sets.push(`${key} = $${i}::uuid`)
        params.push(updates[key] || null)
      } else if (key === "tags") {
        sets.push(`${key} = $${i}::text[]`)
        params.push(Array.isArray(updates[key]) ? updates[key] : [])
      } else if (key.endsWith("_at")) {
        sets.push(`${key} = $${i}::timestamptz`)
        params.push(updates[key] || null)
      } else {
        sets.push(`${key} = $${i}`)
        params.push(updates[key])
      }
      i++
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  sets.push("updated_at = now()")

  try {
    const data = await queryOne(
      `UPDATE support_tickets SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
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
