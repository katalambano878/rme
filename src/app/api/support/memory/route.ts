import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("ai_memory"))) {
    return NextResponse.json({ error: "ai_memory table not configured" }, { status: 501 })
  }

  const body = await request.json()
  const row = await queryOne(
    `INSERT INTO ai_memory (customer_id, customer_email, memory_type, content, importance, source_conversation_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)
     RETURNING *`,
    [
      body.customer_id || null,
      body.customer_email || null,
      body.memory_type || "context",
      body.content,
      body.importance || "normal",
      body.source_conversation_id || null,
    ],
  )
  return NextResponse.json({ data: row }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("ai_memory"))) {
    return NextResponse.json({ error: "ai_memory table not configured" }, { status: 501 })
  }

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await query(`DELETE FROM ai_memory WHERE id = $1::uuid`, [id])
  return NextResponse.json({ success: true })
}
