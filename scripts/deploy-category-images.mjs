import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadDotEnv() {
  const paths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env")
  ]
  for (const p of paths) {
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, "utf8")
    for (const line of text.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

const artifactDir = "C:\\Users\\TAY\\.gemini\\antigravity\\brain\\6a37e297-514a-4796-8a46-2ed31f12eda7"
const targetDir = path.resolve(process.cwd(), "public", "categories")

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const artifacts = fs.readdirSync(artifactDir)

const mapping = {
  "baby_products": "baby-products",
  "body_lotions": "body-lotions",
  "body_wash": "body-wash",
  "hair_appliances": "hair-appliances",
  "skincare_sets": "skincare-sets",
  "skincare": "skincare",
  "makeup": "makeup",
  "lip_scrub": "lip-scrub",
  "lipglosses": "lipglosses",
  "hair_products": "hair-products"
}

async function run() {
  for (const file of artifacts) {
    if (!file.endsWith(".png")) continue;
    
    // figure out which mapping it matches
    for (const [key, slug] of Object.entries(mapping)) {
      // Must match exactly, e.g. "skincare_" to prevent matching "skincare_sets_"
      if (file.startsWith(key + "_")) {
        // copy file
        const src = path.join(artifactDir, file)
        const destFileName = `${slug}.png`
        const dest = path.join(targetDir, destFileName)
        fs.copyFileSync(src, dest)
        console.log(`Copied ${file} to ${dest}`)
        
        // Update database
        const imageUrl = `/categories/${destFileName}`
        const { error } = await supabase
          .from("categories")
          .update({ image_url: imageUrl })
          .eq("slug", slug)
          
        if (error) {
          console.error(`Failed to update ${slug}:`, error)
        } else {
          console.log(`Updated database for ${slug} with ${imageUrl}`)
        }
        break;
      }
    }
  }
}

run().catch(console.error)
