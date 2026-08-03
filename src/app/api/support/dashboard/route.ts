import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  const hasConvos = await tableExists("chat_conversations")
  const hasTickets = await tableExists("support_tickets")
  const hasFeedback = await tableExists("support_feedback")
  const hasMemory = await tableExists("ai_memory")
  const hasKb = await tableExists("support_knowledge_base")

  if (!hasConvos && !hasTickets) {
    return NextResponse.json(
      {
        stats: null,
        recentConversations: [],
        openTickets: [],
        message: "Support tables not configured",
      },
      { status: 501 },
    )
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  try {
    const recentConversations = hasConvos
      ? (await query(`SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT 15`)).rows
      : []

    const openTickets = hasTickets
      ? (
          await query(
            `SELECT * FROM support_tickets
             WHERE status IN ('open', 'in_progress', 'waiting_customer')
             ORDER BY created_at DESC LIMIT 10`,
          )
        ).rows
      : []

    const totalConvos = hasConvos
      ? Number((await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM chat_conversations`))?.c || 0)
      : 0
    const weekConvos = hasConvos
      ? Number(
          (
            await queryOne<{ c: string }>(
              `SELECT COUNT(*)::text AS c FROM chat_conversations WHERE created_at >= $1::timestamptz`,
              [weekAgo],
            )
          )?.c || 0,
        )
      : 0
    const urgent = hasTickets
      ? Number(
          (
            await queryOne<{ c: string }>(
              `SELECT COUNT(*)::text AS c FROM support_tickets
               WHERE priority = 'urgent' AND status IN ('open', 'in_progress')`,
            )
          )?.c || 0,
        )
      : 0
    const resolvedWeek = hasTickets
      ? Number(
          (
            await queryOne<{ c: string }>(
              `SELECT COUNT(*)::text AS c FROM support_tickets
               WHERE status = 'resolved' AND updated_at >= $1::timestamptz`,
              [weekAgo],
            )
          )?.c || 0,
        )
      : 0
    const openCount = hasTickets
      ? Number(
          (
            await queryOne<{ c: string }>(
              `SELECT COUNT(*)::text AS c FROM support_tickets
               WHERE status IN ('open', 'in_progress', 'waiting_customer')`,
            )
          )?.c || 0,
        )
      : 0

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayConvos = hasConvos
      ? Number(
          (
            await queryOne<{ c: string }>(
              `SELECT COUNT(*)::text AS c FROM chat_conversations WHERE created_at >= $1::timestamptz`,
              [todayStart.toISOString()],
            )
          )?.c || 0,
        )
      : 0

    const stats = {
      tickets: { open: openCount, urgent, resolved_week: resolvedWeek },
      conversations: { today: todayConvos, total: totalConvos, week: weekConvos },
      feedback: hasFeedback
        ? Number((await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM support_feedback`))?.c || 0)
        : 0,
      memory: hasMemory
        ? Number((await queryOne<{ c: string }>(`SELECT COUNT(DISTINCT customer_id)::text AS c FROM ai_memory WHERE customer_id IS NOT NULL`))?.c || 0)
        : 0,
      kb: hasKb
        ? Number((await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM support_knowledge_base`))?.c || 0)
        : 0,
    }

    return NextResponse.json({ stats, recentConversations, openTickets })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
