import { query } from "@/lib/db"

/** Core public tables required for Trust Ecom storefront + payments. */
export const REQUIRED_PUBLIC_TABLES = [
  "profiles",
  "storefront_settings",
  "site_settings",
  "categories",
  "products",
  "product_images",
  "variants",
  "orders",
  "order_items",
  "payments",
  "callback_events",
  "sms_attempts",
  "webhook_logs",
  "schema_migrations",
] as const

export type DbHealthResult = {
  connected: boolean
  database?: string
  user?: string
  missingTables: string[]
  tableCount?: number
  storeName?: string | null
  error?: string
}

export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  try {
    const meta = await query<{ db: string; db_user: string }>(
      "select current_database() as db, current_user as db_user",
    )
    const tables = await query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    )
    const names = new Set(tables.rows.map((r) => r.tablename))
    const missingTables = REQUIRED_PUBLIC_TABLES.filter((t) => !names.has(t))

    let storeName: string | null = null
    if (names.has("storefront_settings")) {
      const row = await query<{ store_name: string }>(
        "select store_name from public.storefront_settings where id = 1",
      )
      storeName = row.rows[0]?.store_name ?? null
    }

    return {
      connected: true,
      database: meta.rows[0]?.db,
      user: meta.rows[0]?.db_user,
      missingTables: [...missingTables],
      tableCount: tables.rows.length,
      storeName,
    }
  } catch (err) {
    return {
      connected: false,
      missingTables: [...REQUIRED_PUBLIC_TABLES],
      error: err instanceof Error ? err.message : "database_unreachable",
    }
  }
}
