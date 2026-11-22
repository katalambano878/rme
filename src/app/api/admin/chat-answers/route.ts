import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { questionKey } from "@/lib/chat-answer-library"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIELDS =
  "id, question, question_key, answer, product_ids, quick_replies, source, pinned, hits, created_at, updated_at, last_used_at, expires_at"

async function guard(request: NextRequest) {
  const auth = await requireAdmin(request)
  return auth.authenticated ? null : NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
}

/** List saved answers: most used first, or search by question/answer text. */
export async function GET(request: NextRequest) {
  const denied = await guard(request)
  if (denied) return denied

  const search = (request.nextUrl.searchParams.get("search") || "").replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim().slice(0, 80)
  let q = supabaseAdmin.from("chat_answer_cache").select(FIELDS)
  if (search) q = q.or(`question.ilike.%${search}%,answer.ilike.%${search}%`)
  const { data, error } = await q
    .order("pinned", { ascending: false })
    .order("hits", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/** Add her own answer for a question. */
export async function POST(request: NextRequest) {
  const denied = await guard(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { question?: string; answer?: string; pinned?: boolean }
  const question = String(body.question || "").trim().slice(0, 300)
  const answer = String(body.answer || "").trim().slice(0, 6000)
  const key = questionKey(question)
  if (!question || !answer) return NextResponse.json({ error: "Add both a question and an answer." }, { status: 400 })
  if (key.split(" ").filter(Boolean).length < 2) {
    return NextResponse.json({ error: "Make the question a little more specific (at least two key words)." }, { status: 400 })
  }

  const row = {
    question,
    question_key: key,
    answer,
    product_ids: [] as string[],
    product_prices: [] as number[],
    quick_replies: [] as string[],
    source: "admin",
    pinned: body.pinned !== false,
    expires_at: null,
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await supabaseAdmin.from("chat_answer_cache").select("id").eq("question_key", key).maybeSingle()
  const { error } = existing
    ? await supabaseAdmin.from("chat_answer_cache").update(row).eq("id", existing.id)
    : await supabaseAdmin.from("chat_answer_cache").insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Edit an answer or pin/unpin it. An edited answer becomes hers and never expires. */
export async function PATCH(request: NextRequest) {
  const denied = await guard(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { id?: string; answer?: string; pinned?: boolean }
  if (!body.id || !UUID.test(body.id)) return NextResponse.json({ error: "Missing answer id" }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.answer === "string") {
    const answer = body.answer.trim().slice(0, 6000)
    if (!answer) return NextResponse.json({ error: "The answer can't be empty." }, { status: 400 })
    patch.answer = answer
    patch.source = "admin"
    patch.expires_at = null
  }
  if (typeof body.pinned === "boolean") {
    patch.pinned = body.pinned
    if (body.pinned) patch.expires_at = null
  }

  const { error } = await supabaseAdmin.from("chat_answer_cache").update(patch).eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const denied = await guard(request)
  if (denied) return denied

  const id = request.nextUrl.searchParams.get("id") || ""
  if (!UUID.test(id)) return NextResponse.json({ error: "Missing answer id" }, { status: 400 })
  const { error } = await supabaseAdmin.from("chat_answer_cache").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
