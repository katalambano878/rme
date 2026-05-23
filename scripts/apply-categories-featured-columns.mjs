/**
 * Applies supabase/migrations/20260413120000_categories_featured_and_parent.sql
 * against your Postgres database (same as pasting SQL in Supabase SQL Editor).
 *
 * Requires DATABASE_URL — Supabase Dashboard → Project Settings → Database
 * → Connection string → URI (Session mode or Transaction pooler; include password).
 *
 * Usage:
 *   set DATABASE_URL=postgresql://postgres.xxx:YOUR_PASSWORD@...   (PowerShell)
 *   npm run db:apply-categories
 */

import { readFileSync, existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFiles() {
  const root = join(__dirname, "..")
  for (const name of [".env.local", ".env"]) {
    const p = join(root, name)
    if (!existsSync(p)) continue
    const raw = readFileSync(p, "utf8")
    for (const line of raw.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      if (key === "DATABASE_URL" && val) process.env.DATABASE_URL = val
    }
  }
}
loadEnvFiles()

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  console.error(
    "Missing DATABASE_URL.\n" +
      "1. Supabase → Project Settings → Database → Connection string (URI).\n" +
      "2. Add to .env.local: DATABASE_URL=postgresql://...\n" +
      "3. Run: npm run db:apply-categories",
  )
  process.exit(1)
}

const { default: pg } = await import("pg")

const sqlPath = join(
  __dirname,
  "../supabase/migrations/20260413120000_categories_featured_and_parent.sql",
)
const sql = readFileSync(sqlPath, "utf8")

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  await client.query(sql)
  console.log("Done: featured_on_home and parent_id are on public.categories (if not already).")
} finally {
  await client.end()
}
