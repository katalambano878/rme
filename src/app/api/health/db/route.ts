import { NextResponse } from "next/server"
import { isPlainPostgres } from "@/lib/db/mode"
import { getPool } from "@/lib/db/pool"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Safe DB health probe — no credentials, hosts, or row data exposed.
 */
export async function GET() {
  if (!isPlainPostgres()) {
    return NextResponse.json(
      { status: "unhealthy", database: "not_configured" },
      { status: 503 },
    )
  }

  try {
    const pool = getPool()
    const started = Date.now()
    const res = await pool.query(
      `SELECT 1 AS ok,
              (SELECT count(*)::int FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables`,
    )
    const latencyMs = Date.now() - started
    const tables = Number(res.rows[0]?.tables ?? 0)
    const healthy = res.rows[0]?.ok === 1 && tables >= 30
    return NextResponse.json({
      status: healthy ? "healthy" : "degraded",
      database: "postgres",
      tables,
      latencyMs,
    })
  } catch {
    return NextResponse.json(
      { status: "unhealthy", database: "postgres" },
      { status: 503 },
    )
  }
}
