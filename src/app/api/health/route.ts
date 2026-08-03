import { NextResponse } from "next/server"
import { healthEnvReport } from "@/lib/env"

export const dynamic = "force-dynamic"

/**
 * Public health check — never returns secret values or hosts.
 */
export async function GET() {
  const env = healthEnvReport()

  let database: {
    status: "skipped" | "ok" | "degraded" | "error"
    tableCount?: number
    missingTables?: string[]
    storeName?: string | null
  } = { status: "skipped" }

  if (process.env.DATABASE_URL) {
    try {
      const { checkDatabaseHealth } = await import("@/lib/db-health")
      const health = await checkDatabaseHealth()
      if (!health.connected) {
        database = { status: "error" }
      } else if (health.missingTables.length > 0) {
        database = {
          status: "degraded",
          tableCount: health.tableCount,
          missingTables: health.missingTables,
          storeName: health.storeName,
        }
      } else {
        database = {
          status: "ok",
          tableCount: health.tableCount,
          storeName: health.storeName,
        }
      }
    } catch {
      database = { status: "error" }
    }
  }

  const overall =
    database.status === "error"
      ? "unhealthy"
      : database.status === "degraded" || !env.ok
        ? "degraded"
        : "ok"

  const httpStatus = overall === "unhealthy" ? 503 : 200

  return NextResponse.json(
    {
      status: overall,
      app: "trust-ecom",
      timestamp: new Date().toISOString(),
      database,
      runtime: {
        primaryDataClient: "postgres",
        plainPostgresPool: Boolean(process.env.DATABASE_URL),
      },
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
    { status: httpStatus },
  )
}
