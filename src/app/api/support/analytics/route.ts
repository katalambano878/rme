import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  const hasConversations = await tableExists("chat_conversations")
  const hasTickets = await tableExists("support_tickets")
  const hasFeedback = await tableExists("support_feedback")

  if (!hasConversations && !hasTickets) {
    return NextResponse.json(
      {
        summary: {
          totalConversations: 0,
          totalTickets: 0,
          totalFeedback: 0,
          avgRating: "0",
          aiHandled: 0,
          escalated: 0,
          resolved: 0,
          avgResolutionHours: "0",
          avgFirstResponseMinutes: "0",
        },
        categoryBreakdown: {},
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        ratingDistribution: [0, 0, 0, 0, 0],
        dailyData: [],
        ticketStatusBreakdown: {},
        ticketPriorityBreakdown: {},
        message: "Support tables not configured",
      },
      { status: 501 },
    )
  }

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get("days") || "30", 10)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  try {
    const conversations = hasConversations
      ? (
          await query(
            `SELECT id, created_at, sentiment, category, is_resolved, is_escalated, ai_handled, message_count, duration_seconds
             FROM chat_conversations WHERE created_at >= $1::timestamptz ORDER BY created_at ASC`,
            [since],
          )
        ).rows
      : []

    const tickets = hasTickets
      ? (
          await query(
            `SELECT id, created_at, status, priority, category, resolved_at, first_response_at
             FROM support_tickets WHERE created_at >= $1::timestamptz ORDER BY created_at ASC`,
            [since],
          )
        ).rows
      : []

    const feedback = hasFeedback
      ? (
          await query(
            `SELECT rating, created_at FROM support_feedback WHERE created_at >= $1::timestamptz`,
            [since],
          )
        ).rows
      : []

    const categoryBreakdown: Record<string, number> = {}
    for (const c of conversations as { category?: string }[]) {
      if (c.category) categoryBreakdown[c.category] = (categoryBreakdown[c.category] || 0) + 1
    }

    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 }
    for (const s of conversations as { sentiment?: string }[]) {
      if (s.sentiment === "positive") sentimentBreakdown.positive++
      else if (s.sentiment === "negative") sentimentBreakdown.negative++
      else sentimentBreakdown.neutral++
    }

    const ratingDist = [0, 0, 0, 0, 0]
    for (const f of feedback as { rating?: number }[]) {
      if (f.rating != null && f.rating >= 1 && f.rating <= 5) ratingDist[f.rating - 1]++
    }

    const resolved = (tickets as { resolved_at?: string; created_at: string }[]).filter((t) => t.resolved_at)
    const avgResolutionMs =
      resolved.length > 0
        ? resolved.reduce(
            (sum, t) =>
              sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()),
            0,
          ) / resolved.length
        : 0

    const responded = (tickets as { first_response_at?: string; created_at: string }[]).filter(
      (t) => t.first_response_at,
    )
    const avgFirstResponseMs =
      responded.length > 0
        ? responded.reduce(
            (sum, t) =>
              sum + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()),
            0,
          ) / responded.length
        : 0

    return NextResponse.json({
      summary: {
        totalConversations: conversations.length,
        totalTickets: tickets.length,
        totalFeedback: feedback.length,
        avgRating:
          feedback.length > 0
            ? (
                (feedback as { rating: number }[]).reduce((s, f) => s + f.rating, 0) / feedback.length
              ).toFixed(2)
            : "0",
        aiHandled: (conversations as { ai_handled?: boolean }[]).filter((c) => c.ai_handled).length,
        escalated: (conversations as { is_escalated?: boolean }[]).filter((c) => c.is_escalated).length,
        resolved: (conversations as { is_resolved?: boolean }[]).filter((c) => c.is_resolved).length,
        avgResolutionHours: (avgResolutionMs / 3600000).toFixed(1),
        avgFirstResponseMinutes: (avgFirstResponseMs / 60000).toFixed(1),
      },
      categoryBreakdown,
      sentimentBreakdown,
      ratingDistribution: ratingDist,
      dailyData: [],
      ticketStatusBreakdown: {
        open: (tickets as { status?: string }[]).filter((t) => t.status === "open").length,
        in_progress: (tickets as { status?: string }[]).filter((t) => t.status === "in_progress").length,
        waiting_customer: (tickets as { status?: string }[]).filter((t) => t.status === "waiting_customer")
          .length,
        resolved: (tickets as { status?: string }[]).filter((t) => t.status === "resolved").length,
        closed: (tickets as { status?: string }[]).filter((t) => t.status === "closed").length,
      },
      ticketPriorityBreakdown: {
        low: (tickets as { priority?: string }[]).filter((t) => t.priority === "low").length,
        medium: (tickets as { priority?: string }[]).filter((t) => t.priority === "medium").length,
        high: (tickets as { priority?: string }[]).filter((t) => t.priority === "high").length,
        urgent: (tickets as { priority?: string }[]).filter((t) => t.priority === "urgent").length,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
