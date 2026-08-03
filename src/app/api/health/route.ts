import { NextResponse } from "next/server"
import { healthEnvReport } from "@/lib/env"

export const dynamic = "force-dynamic"

/**
 * Public health check — never returns secret values.
 */
export async function GET() {
  const env = healthEnvReport()

  let database: "skipped" | "ok" | "error" = "skipped"
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("@/lib/db")
      await query("select 1 as ok")
      database = "ok"
    } catch {
      database = "error"
    }
  }

  const status =
    env.ok && database !== "error"
      ? 200
      : database === "error"
        ? 503
        : 200

  return NextResponse.json(
    {
      status: status === 200 ? "ok" : "degraded",
      app: "trust-ecom",
      timestamp: new Date().toISOString(),
      database,
      env: {
        runtimeConfigured: env.missingRuntime.length === 0,
        paymentsConfigured: env.missingPayments.length === 0,
        smsConfigured: env.missingSms.length === 0,
        databaseConfigured: env.missingDatabase.length === 0,
        missingRuntime: env.missingRuntime,
        missingPayments: env.missingPayments,
        missingSms: env.missingSms,
      },
    },
    { status },
  )
}
