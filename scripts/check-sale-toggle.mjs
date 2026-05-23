/**
 * Live check for the Sales-page toggle button.
 *
 *   1. Reads current site_settings.feature_flags
 *   2. Flips sale_promotion_enabled
 *   3. Reads it again to confirm the write took effect
 *   4. Flips it back to its original value (non-destructive)
 *
 * Run: node scripts/check-sale-toggle.mjs
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadDotEnv() {
  for (const p of [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")]) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
}
loadDotEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing SUPABASE creds in .env.local")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function tag(ok) {
  return ok ? "PASS" : "FAIL"
}

async function readFlags() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("feature_flags")
    .eq("id", 1)
    .maybeSingle()
  if (error) throw error
  return data?.feature_flags ?? null
}

async function main() {
  console.log("=== Sale toggle live check ===\n")

  // 1. Row exists?
  const initial = await readFlags()
  if (initial === null) {
    console.log(`[${tag(false)}] site_settings row id=1 not found.`)
    process.exit(1)
  }
  const initialEnabled = initial.sale_promotion_enabled === true
  console.log(`[${tag(true)}] site_settings row exists.`)
  console.log(`         current sale_promotion_enabled = ${initialEnabled}`)
  console.log(`         current feature_flags          = ${JSON.stringify(initial)}`)

  // 2. Toggle
  const flipped = { ...initial, sale_promotion_enabled: !initialEnabled }
  const { error: upErr } = await supabase
    .from("site_settings")
    .update({ feature_flags: flipped })
    .eq("id", 1)
  if (upErr) {
    console.log(`[${tag(false)}] Update failed: ${upErr.message}`)
    process.exit(1)
  }
  console.log(`[${tag(true)}] update() succeeded.`)

  // 3. Read back
  const after = await readFlags()
  const afterEnabled = after?.sale_promotion_enabled === true
  const flipOk = afterEnabled === !initialEnabled
  console.log(
    `[${tag(flipOk)}] after flip: sale_promotion_enabled = ${afterEnabled} (expected ${!initialEnabled})`,
  )

  // 4. Restore original value so this script is non-destructive
  const restored = { ...after, sale_promotion_enabled: initialEnabled }
  const { error: restoreErr } = await supabase
    .from("site_settings")
    .update({ feature_flags: restored })
    .eq("id", 1)
  if (restoreErr) {
    console.log(`[${tag(false)}] Restore failed: ${restoreErr.message}`)
    process.exit(1)
  }
  const final = await readFlags()
  const finalEnabled = final?.sale_promotion_enabled === true
  const restoreOk = finalEnabled === initialEnabled
  console.log(
    `[${tag(restoreOk)}] restored: sale_promotion_enabled = ${finalEnabled} (matches original ${initialEnabled})`,
  )

  // Other flags preserved?
  const initialOtherKeys = Object.keys(initial).filter((k) => k !== "sale_promotion_enabled")
  const preservedOk = initialOtherKeys.every(
    (k) => JSON.stringify(initial[k]) === JSON.stringify(final?.[k]),
  )
  console.log(`[${tag(preservedOk)}] all other feature_flags preserved.`)

  console.log("\nFinal flags:", JSON.stringify(final))
  console.log(
    flipOk && restoreOk && preservedOk
      ? "\nResult: the Sales-page toggle is fully functional (read + write + restore)."
      : "\nResult: there is a problem with the toggle wiring. See FAILs above.",
  )
}

main().catch((e) => {
  console.error("error:", e)
  process.exit(1)
})
