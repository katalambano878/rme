#!/usr/bin/env node
/**
 * Create a store admin user in auth.users + profiles (plain Postgres).
 *
 * Requires DATABASE_URL in .env.local or the environment.
 *
 * Usage:
 *   node scripts/create-admin-user.mjs you@example.com 'YourSecurePassword'
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import pg from "pg"
import bcrypt from "bcryptjs"

function loadDotEnvLocal() {
  const p = resolve(process.cwd(), ".env.local")
  if (!existsSync(p)) return
  const text = readFileSync(p, "utf8")
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const [emailRaw, password] = process.argv.slice(2)
if (!emailRaw || !password) {
  console.error(
    "Usage: node scripts/create-admin-user.mjs <email> <password>\n" +
      "Example: node scripts/create-admin-user.mjs admin@shop.com 'Str0ng!pass'",
  )
  process.exit(1)
}

loadDotEnvLocal()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.env.local).")
  process.exit(1)
}

const email = emailRaw.toLowerCase().trim()
const pool = new pg.Pool({ connectionString: databaseUrl })

try {
  const encrypted = await bcrypt.hash(password, 12)
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const existing = await client.query(
      `SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    )

    let userId
    if (existing.rows[0]) {
      userId = existing.rows[0].id
      await client.query(
        `UPDATE auth.users
         SET encrypted_password = $2, email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
         WHERE id = $1`,
        [userId, encrypted],
      )
    } else {
      const inserted = await client.query(
        `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
         VALUES ($1, $2, now(), '{}'::jsonb)
         RETURNING id`,
        [email, encrypted],
      )
      userId = inserted.rows[0].id
    }

    await client.query(
      `INSERT INTO public.store_admins (email) VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [email],
    ).catch(() => {})

    await client.query(
      `UPDATE public.profiles
       SET role = 'admin', email = $2, updated_at = now()
       WHERE id = $1`,
      [userId, email],
    )

    // If trigger didn't create profile
    await client.query(
      `INSERT INTO public.profiles (id, email, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (id) DO UPDATE
       SET role = 'admin', email = EXCLUDED.email, updated_at = now()`,
      [userId, email],
    )

    await client.query("COMMIT")
    console.log(`Admin ready: ${email} (${userId})`)
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
} finally {
  await pool.end()
}
