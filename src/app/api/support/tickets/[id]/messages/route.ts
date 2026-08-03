import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(_req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_ticket_messages"))) {
    return NextResponse.json({ data: [], message: "Support messages table not configured" }, { status: 501 })
  }

  const { id } = await params
  try {
    const result = await query(
      `SELECT * FROM support_ticket_messages WHERE ticket_id = $1::uuid ORDER BY created_at ASC`,
      [id],
    )
    return NextResponse.json({ data: result.rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_ticket_messages"))) {
    return NextResponse.json({ error: "Support messages table not configured" }, { status: 501 })
  }

  const { id } = await params
  const body = await req.json()

  try {
    const data = await queryOne(
      `INSERT INTO support_ticket_messages (
         ticket_id, sender_type, sender_id, sender_name, content, is_internal, attachments
       ) VALUES (
         $1::uuid, $2, $3::uuid, $4, $5, $6, $7::jsonb
       ) RETURNING *`,
      [
        id,
        body.sender_type || "agent",
        body.sender_id || null,
        body.sender_name || "Admin",
        body.content,
        Boolean(body.is_internal),
        JSON.stringify(body.attachments || []),
      ],
    )

    if (!body.is_internal && (await tableExists("support_tickets"))) {
      await query(
        `UPDATE support_tickets
         SET first_response_at = COALESCE(first_response_at, now()),
             status = CASE WHEN $2 = 'agent' THEN 'waiting_customer' ELSE 'in_progress' END,
             updated_at = now()
         WHERE id = $1::uuid`,
        [id, body.sender_type || "agent"],
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
