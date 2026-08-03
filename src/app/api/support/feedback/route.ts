import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  if (!(await tableExists("support_feedback"))) {
    return NextResponse.json({ error: "Feedback table not configured" }, { status: 501 })
  }

  const clientIp = getClientIdentifier(req)
  const limit = checkRateLimit(`feedback:${clientIp}`, { maxRequests: 10, windowSeconds: 60 * 60 })
  if (!limit.success) {
    return NextResponse.json({ error: "Too many feedback submissions." }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const conversationId =
    typeof body.conversation_id === "string" ? body.conversation_id.slice(0, 64) : null
  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id.slice(0, 64) : null

  if (!conversationId && !ticketId) {
    return NextResponse.json({ error: "conversation_id or ticket_id required" }, { status: 400 })
  }

  if (conversationId && (await tableExists("chat_conversations"))) {
    const convo = await queryOne(`SELECT id FROM chat_conversations WHERE id = $1::uuid`, [conversationId])
    if (!convo) return NextResponse.json({ error: "Unknown conversation" }, { status: 404 })
  }
  if (ticketId && (await tableExists("support_tickets"))) {
    const ticket = await queryOne(`SELECT id FROM support_tickets WHERE id = $1::uuid`, [ticketId])
    if (!ticket) return NextResponse.json({ error: "Unknown ticket" }, { status: 404 })
  }

  const ratingNum = Number(body.rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "rating must be an integer 1–5" }, { status: 400 })
  }

  const customerEmail =
    typeof body.customer_email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email)
      ? body.customer_email.slice(0, 200)
      : null

  const feedbackText =
    typeof body.feedback_text === "string" ? body.feedback_text.slice(0, 2000) : null

  const feedbackCategories = Array.isArray(body.feedback_categories)
    ? body.feedback_categories
        .filter((c: unknown) => typeof c === "string")
        .slice(0, 10)
        .map((c: string) => c.slice(0, 50))
    : []

  try {
    const data = await queryOne(
      `INSERT INTO support_feedback (
         conversation_id, ticket_id, customer_id, customer_email, rating, feedback_text, feedback_categories
       ) VALUES (
         $1::uuid, $2::uuid, NULL, $3, $4, $5, $6::text[]
       ) RETURNING *`,
      [conversationId, ticketId, customerEmail, ratingNum, feedbackText, feedbackCategories],
    )
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Insert failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_feedback"))) {
    return NextResponse.json({ data: [], message: "Feedback table not configured" }, { status: 501 })
  }

  try {
    const result = await query(
      `SELECT * FROM support_feedback ORDER BY created_at DESC LIMIT 100`,
    )
    return NextResponse.json({ data: result.rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}
