#!/usr/bin/env node
/**
 * Create a store admin user (Supabase Auth + profiles.role via trigger).
 *
 * Requires in .env.local or the environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (never commit; server-only)
 *
 * Usage:
 *   node scripts/create-admin-user.mjs you@example.com 'YourSecurePassword'
 *
 * Or: npm run create-admin -- you@example.com 'YourSecurePassword'
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

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

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error(
    "Usage: node scripts/create-admin-user.mjs <email> <password>\n" +
      "Example: node scripts/create-admin-user.mjs admin@shop.com 'Str0ng!pass'",
  )
  process.exit(1)
}

loadDotEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).",
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { error: allowError } = await supabase
  .from("store_admins")
  .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" })

if (allowError) {
  console.error("store_admins insert failed:", allowError.message)
  process.exit(1)
}

const { data, error } = await supabase.auth.admin.createUser({
  email: email.trim(),
  password,
  email_confirm: true,
})

if (error) {
  console.error("createUser failed:", error.message)
  process.exit(1)
}

console.log("Admin user created:", data.user?.email)
console.log("Sign in at /auth/login with that email and password, then open /admin")
