import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadDotEnv() {
  const paths = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env")
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
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
}

loadDotEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  console.error("Missing SUPABASE credentials.");
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  const { data, error } = await supabase.from("categories").select("*")
  if (error) {
    console.error("error:", error)
    process.exit(1)
  }
  console.log("Categories:", JSON.stringify(data, null, 2))
}

run()
