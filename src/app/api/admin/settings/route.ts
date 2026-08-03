import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  try {
    const row = await queryOne<{ feature_flags: unknown }>(
      `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
    )
    const flags = (row?.feature_flags as Record<string, unknown> | null) ?? {}
    return NextResponse.json({ feature_flags: flags })
  } catch (err: unknown) {
    console.error("[admin/settings GET]", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const incoming = body.feature_flags
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "feature_flags object required" }, { status: 400 })
    }

    const row = await queryOne<{ feature_flags: unknown }>(
      `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
    )
    const current = (row?.feature_flags as Record<string, unknown> | null) ?? {}
    const merged = { ...current, ...incoming }

    const updated = await queryOne(
      `UPDATE site_settings SET feature_flags = $1::jsonb, updated_at = now() WHERE id = 1 RETURNING feature_flags`,
      [JSON.stringify(merged)],
    )

    return NextResponse.json({ feature_flags: updated?.feature_flags ?? merged })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed"
    console.error("[admin/settings PATCH]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
