import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from "pg"

/**
 * Shared PostgreSQL pool for plain-Postgres runtime (VPS / fleet).
 * Hot-reload safe via globalThis. Prefer this over creating a Pool per request.
 * Set DATABASE_URL to the store_* database (e.g. store_trustecom).
 */

declare global {
  // eslint-disable-next-line no-var
  var __trustEcomPgPool: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL — set it in .env.local (see .env.example)")
  }

  const ssl =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "1" ||
    /sslmode=require/i.test(connectionString)
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10_000),
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 30_000),
    ssl,
  })
}

export function getPool(): Pool {
  if (!global.__trustEcomPgPool) {
    global.__trustEcomPgPool = createPool()
  }
  return global.__trustEcomPgPool
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params)
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] ?? null
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const value = await fn(client)
    await client.query("COMMIT")
    return value
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  if (global.__trustEcomPgPool) {
    await global.__trustEcomPgPool.end()
    global.__trustEcomPgPool = undefined
  }
}
