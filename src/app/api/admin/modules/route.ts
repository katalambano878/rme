import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { tableExists } from "@/lib/data/support-pg"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await tableExists("store_modules"))) {
    return NextResponse.json({ data: [], message: "store_modules table not configured" }, { status: 501 })
  }

  try {
    const result = await query(`SELECT * FROM store_modules ORDER BY module_key ASC`)
    return NextResponse.json({ data: result.rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed"
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await tableExists("store_modules"))) {
    return NextResponse.json({ error: "store_modules table not configured" }, { status: 501 })
  }

  const body = await request.json()
  const { module_key, enabled, config = {} } = body
  if (!module_key) {
    return NextResponse.json({ error: "module_key required" }, { status: 400 })
  }

  try {
    const row = await queryOne(
      `INSERT INTO store_modules (module_key, enabled, config)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (module_key) DO UPDATE SET enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = now()
       RETURNING *`,
      [module_key, Boolean(enabled), JSON.stringify(config)],
    )
    return NextResponse.json({ data: row })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Save failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
