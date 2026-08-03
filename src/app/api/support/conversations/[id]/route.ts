import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(_req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("chat_conversations"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const { id } = await context.params
  const conv = await queryOne(`SELECT * FROM chat_conversations WHERE id = $1::uuid`, [id])
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let memories: unknown[] = []
  if (await tableExists("ai_memory")) {
    const memParams: unknown[] = [id]
    let memSql = `SELECT * FROM ai_memory WHERE conversation_id = $1::uuid ORDER BY created_at DESC`
    if ((conv as { user_id?: string }).user_id) {
      memSql = `SELECT * FROM ai_memory WHERE customer_id = $1::uuid OR conversation_id = $1::uuid ORDER BY created_at DESC`
    } else if ((conv as { customer_email?: string }).customer_email) {
      memSql = `SELECT * FROM ai_memory WHERE customer_email = $1 ORDER BY created_at DESC`
      memParams[0] = (conv as { customer_email: string }).customer_email
    }
    const mem = await query(memSql, memParams)
    memories = mem.rows
  }

  return NextResponse.json({ data: conv, memories })
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("chat_conversations"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const { id } = await context.params
  const body = await req.json()
  const allowed = ["is_resolved", "is_escalated", "sentiment", "category", "summary", "notes"] as const
  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i}`)
      params.push(body[key])
      i++
    }
  }

  if (body.is_escalated === true) {
    sets.push(`escalated_at = now()`)
  }

  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 })
  sets.push("updated_at = now()")

  const data = await queryOne(
    `UPDATE chat_conversations SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
    params,
  )
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("ai_memory"))) {
    return NextResponse.json({ error: "AI memory not configured" }, { status: 501 })
  }

  const { id } = await context.params
  const body = await req.json()
  const conv = await queryOne<{ user_id: string | null; customer_email: string | null }>(
    `SELECT user_id, customer_email FROM chat_conversations WHERE id = $1::uuid`,
    [id],
  )
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const memory = await queryOne(
    `INSERT INTO ai_memory (
       customer_id, customer_email, memory_type, content, importance, source_conversation_id
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)
     RETURNING *`,
    [
      conv.user_id || body.customer_id || null,
      conv.customer_email || body.customer_email || null,
      body.memory_type || "context",
      body.content,
      body.importance || "normal",
      id,
    ],
  )
  return NextResponse.json({ data: memory }, { status: 201 })
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("ai_memory"))) {
    return NextResponse.json({ error: "AI memory not configured" }, { status: 501 })
  }

  const memoryId = new URL(req.url).searchParams.get("memoryId")
  if (!memoryId) return NextResponse.json({ error: "memoryId required" }, { status: 400 })

  await query(`DELETE FROM ai_memory WHERE id = $1::uuid`, [memoryId])
  return NextResponse.json({ success: true })
}
