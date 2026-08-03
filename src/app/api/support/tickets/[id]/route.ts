import { NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(_req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_tickets"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const { id } = await context.params
  const ticket = await queryOne(`SELECT * FROM support_tickets WHERE id = $1::uuid`, [id])
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: ticket })
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!(await tableExists("support_tickets"))) {
    return NextResponse.json({ error: "Support tables not configured" }, { status: 501 })
  }

  const { id } = await context.params
  const body = await req.json()
  const allowed = ["status", "priority", "assigned_to", "category", "tags", "subject", "description"] as const
  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in body) {
      if (key === "assigned_to") {
        sets.push(`${key} = $${i}::uuid`)
        params.push(body[key] || null)
      } else if (key === "tags") {
        sets.push(`${key} = $${i}::text[]`)
        params.push(Array.isArray(body[key]) ? body[key] : [])
      } else {
        sets.push(`${key} = $${i}`)
        params.push(body[key])
      }
      i++
    }
  }

  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 })
  sets.push("updated_at = now()")

  const data = await queryOne(
    `UPDATE support_tickets SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
    params,
  )
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data })
}
