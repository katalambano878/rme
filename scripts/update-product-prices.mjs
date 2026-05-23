/**
 * Updates product prices in Supabase from a hardcoded list.
 *
 * Usage:
 *   node scripts/update-product-prices.mjs            # dry-run (preview only)
 *   node scripts/update-product-prices.mjs --apply    # apply updates to DB
 *
 * Behavior:
 *   - Updates products.price for each matched product (matched by name, case-insensitive)
 *   - Also updates variants.price for every variant of a matched product, because
 *     the storefront/admin uses variant prices when present (see lib/product-metrics.ts).
 *   - Leaves products.compare_at_price untouched.
 *   - Reports unmatched names and DB-only products at the end.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

// -----------------------------------------------------------------------------
// 1. Raw price list (exactly as provided)
// -----------------------------------------------------------------------------
const RAW_LIST = `
1	2 Step Mascara (very good)	35	
2	3Q Beauty Magic Lip Oil 20		
3	3piece Claw Clip	25	
4	Advanced Korean Body Lotion	250.00	
5	Advanced Korean Skin Face Cream	160.00	
6	Aloe Vera Body Scrub	40	
7	Aloe Vera Gel	65	
8	Alpha Arbutin Body Scrub	80	
9	Anua 10+ Niacinamide Serum	350
10	Apricot Body Scrub	40	
11	Aqua Rich Body Lotion	150	
12	Argan Oil Hand and Nail Cream	45
13	Argan Oil Heat Protectant	45	
14	Asepso Acne Care Bar Soap	25	
15	Aveeno Daily Moisturizing Body Mist	220.00	
16	Avocado Body Scrub	40	
17	Bathroom Set (3 Piece Set)	50.00	
18	Beauty Formulas 10%Aha+2%Bha(Renewing Serum)	60
19	Beauty Formulas Brightening Facial Wipes	30	
20	Beauty Formulas Brightening Vitamin C Eye Gel	55	
21	Beauty Formulas Brightening Vitamin C Eye Gel Patches(6 Pairs)	50
22	Beauty Formulas Brightening Vitamin C Facial Serum(Tube)	60	
23	Beauty Formulas Brightening Vitamin C Facial Toner	50	
24	Beauty Formulas Brightening Vitamin C Moisturiser	50	
25	Beauty Formulas Ceramides Set(4pcs)	170
26	Beauty Formulas Glowing Serum (Vitamin C)2%	60	
27	Beauty Formulas Hyaluronic Acid Serum(Moisture Serum)	60	
28	Beauty Formulas Niacinamide Serum(Illuminating Serum)	60	
29	Beauty Formulas Oil Control Facial Wash	60	
30	Beauty Formulas Vitamin C Facial Set(6pcs)+Free Facial Mask	240	
31	Big size Claw Clip	20	
32	Bio Oil (200ML)	150	
33	Bioaqua Centella set	300	
34	Bioaqua Rice Raw Pulp Serum	75
35	Bioaqua Rice Raw Pulp Set (6pcs)	300
36	Bioaqua Serum Combination Set	150
37	Brightening Skin care Set(Tumeric and Vitamin C)	160	
38	Brightening Vitamin C Facial Scrub	50
39	Brightening Vitamin C Facial Wash	50	
40	Brow Sculpting Gel(Brow Gel)	35	
41	Bubble Keyholder Gloss	25.00	
42	Caviar with Collagen Heat Protectant	75	
43	CeraVe Daily Moisturising Lotion	280
44	Cetaphil Gentle Foaming Cleanser	150	
45	Cetaphil Gentle Skin Cleanser	250
46	Cetaphil Moisturizing Lotion	300	
47	Chilly Feminine Wipes	60	
48	Chilly Idratante Feminine Wash (Big Size)	100
49	Chilly Intima Idratante (Small Size)	80
50	Chilly Mint Feminine Wash(Small Size)	80
51	Chilly Mint Feminine Wash(big size)	100	
52	Chilly pH 6.5 Feminine Wash	100	
53	Claw Clip	15	
54	Cluster Lash Set With(Remover,Bond and seal, Tweezer)	120
55	Cosmetic Mirror	50
56	Cucumber Body Scrub	40	
57	Detangler Brushes	20	
58	Disaar Snail Mucin Soap(For Face and Body)	60	
59	Dr Rashel 60+ Spf	 65
60	Dr Rashel Charcoal Black Soap	50
61	Dr Rashel Vitamin C Set	335.00	
62	Dr Rashel Vitamin C bar soap	50.00	
63	Dr Rashel Whitening Fade Soap	50.00	
64	Dr Teals Vitamin C Body Lotion	140
65	Dr Teals Vitamin C Body Wash	140
66	Dr Vitamin C Wash and Lotion COMBO	260.00	
67	EOS Fresh and Cozy Body Wash	250
68	EOS Vanilla Cashmere Lotion	250	
69	ESTELIN Sun Screen SPF 100(100g)	100
70	ESTELIN Sun Screen SPF 50– Long-Lasting Sun Protection(50g)	70
71	ESTELIN Sun Screen SPF 80 – Long-Lasting Sun Protection(100g)	100	
72	Edge Styling Brush Duo	35	
73	Estelin B5 Ceramide Repairing Face Serum	70	
74	Estelin Hyaluronic Acid Face Serum	70
75	Estelin Multi Defense Tinted Sunscreen SPF 70 (50g)	70	
76	Estelin Rice Collagen Firming Face Serum (30ml)	70	
77	Estelin Salicylic Acid & Tea Tree Oil Face Serum	70	
78	Estelin Toner	75	
79	Estelin Vitamin A Retinol Age-Defying Face Serum	70	
80	Estelin Vitamin C & Turmeric Brightening Face Serum	70	
81	Everyday skincare set for All Skin Types	340.00	
82	Ezanic 10%Azelaic Acid Cream	140	
83	Ezanic 20% Azelaic Acid Gel	150	
84	Face Facta Ceramide Serum	70	
85	Face Facts Blemish Patches	50	
86	Face Facts Body Lotions	120	
87	Face Facts Ceramide Blemish Clarifying Foaming Cleanser (400ml)	110	
88	Face Facts Ceramide Blemish Gel Moisturizer	60	
89	Face Facts Ceramide Blemish Treatment Gel	60	
90	Face Facts Ceramide Foaming Cleanser (400ml) 110	
91	Face Facts Ceramide Hydrating Gentle Cleanser	75
92	Face Facts Ceramide Moisturising Gel Cream	60	
93	Face Facts Ceramide Oil Control Foaming Cleanser	110	
94	Face Facts Ceramide Oil Control Set	220
95	Face Facts Ceramide Repairing Serum Cream	 60	
96	Face Facts Collagen Serum	60	
97	Face Facts Hyaluronic Acid Serum	60	
98	Face Facts Lactic Acid Serum	60	
99	Face Facts Niacinamide Serum	60
100	Face Facts Polypeptide Serum	60	
101	Face Facts Retinol Serum	60	
102	Face Facts Salicylic Serum	60
103	Face Facts The Routine Step.02 Superberry Radiance Serum	65
104	Face Facts Vitamin C Serum	60	
105	Face Facts Wonder Cream	120	
106	Face facts 3in1 set serums	130	
107	Fem Fresh Wash	80
108	Flower Claw Clip(State your colour in the description)	15.00	
109	Glam and Glory Hair Removal Cream(Lemon/Rose/Aloe Vera)	40
110	Glow Booster Lightening Oil	120	
111	Hair Fine Mist Spray Bottle	55
112	Honey Gold Keyholder Lipgloss	25.00	
113	Hot Comb	160	
114	Huda Katyl Lip oil	15	
115	Jam Rice Milk Soap	20	
116	Jersey Headband (Small Size)	10
117	Jersey Headbands (Big Size)	15
118	Jersey Headbands(Medium Size)	12
119	Jumbo Plus Velvet Bonnet	75	
120	Karité lip oil and balm combo 2-in-1 Lip Care	30	
121	Keyholder Blush	30.00	
122	Kuu Spa Tumeric Scrub	70	
123	Lip Tint Water Mist	18.00	
124	Marble 3pcs Claw Clip Set	30	
125	Medix 5.5 Vitamin C+Tumeric Lotion	250
126	Microfiber Hair Towel	50	
127	Mini straighteners	50	
128	Miss Betty Hydrate Lip Oil	15
129	Moist Magic Lip Oil	25.00	
130	Mooyam Collagen Wrapping Overnight Face mask	50	
131	Mooyam Orange Peeling Lotion	75	
132	Mooyam Turmeric & Kojic Cleansing Pads	65.00	
133	Mouth Spray(Reduced to Clear)	35.00	
134	Nature Spell Anti-Aging Serum	110	
135	Nature Spell Glow Up Face Cream	120
136	Nature Spell Niacinamide+1% Zinc Serum	110
137	Nature Spell Under Eye Serum	110	
138	Nature Spell Vitamin C Serum	110
139	Nature's Spell Vitamin c+Pineapple	150	
140	Neutrogena 2% Salicylic Acid Facial Wash	95	
141	Neutrogena Blackhead Eliminating Face Scrub	85	
142	Neutrogena Clear & Radiant Face Wash	95
143	Neutrogena Clear And Smooth Moisturizer	100	
144	Neutrogena Clear and Defend Face Scrub	90	
145	Neutrogena Clear and Defend Moisturiser	110
146	Neutrogena Clear and Radiant Facial Moisturizer	100	
147	Neutrogena Clear and Radiant Set	185.00	
148	Neutrogena Oil Balancing Facial Wash	100	
149	Neutrogena SOS Gel	110	
150	Neutrogena Salycilic Acid Set	295.00	
151	Oil Control Set +Free Cotton Pad	260.00	
152	Palmer Skin Success (Anti Dark Spot) Moisturiser	120	
153	Palmer Skin Success Fade Milk	160
154	Palmer's Skin Therapy Oil	200	
155	Palmers Cocoa Butter Collection	440
156	Palmers Cocoa Butter Formula Body Oil	140
157	PanOxyl Acne Foaming Wash 10%	250
158	Pearl Claw Clip	20	
159	Plain Lip Gloss	15	
160	RJ Magic Pink Lips Cream	40
161	Romantic Rain 2in1 Lip Gloss	30.00	
162	Romantic Rain Clear Gloss Waterproof	15.00	
163	Sadoer Aloe Vera Pearl Body Wash	75	
164	Sadoer Centella Serum	75	
165	Sadoer Collagen Sakura Elasticity Cream	60	
166	Sadoer Collagen Sakura Moist Hydrate Serum	65
167	Sadoer Lemon Mouthwash(12pcs)	50.00	
168	Sadoer Orange Pearl Body Wash	75	
169	Selfie Light/Drip Light with Magnet and 5 different colours	110	
170	Shein Red Skirt	150	
171	Silicone Bra	80	
172	Silicone Nipple Covers	65	
173	Simple 10% Vitamin C+E+F Booster Serum	120	
174	Simple Age Resisting Facial Wash	90
175	Simple Booster Serum 10% Niacinamide (Vitamin B3)	120	
176	Simple Booster Serum 3% Hyaluronic Acid & Vitamin B5	120	
177	Simple Clear Pore Scrub	110
178	Simple Hydrating Light Facial Moisturizer	90
179	Simple Moisturising Facial Wash	85
180	Simple Replenishing Rich Moisturiser	90	
181	Simple Serum Set+Pouch	300.00	
182	Skin Aqua Sunscreen (big size)	220	
183	Skin Doctor Aloe Vera Gel	75	
184	Skincare headband and Wristband	50
185	Soft7 Tumeric and Honey Soap	50
186	Sonar 5in1 set Hand dryer	120	
187	Sonar Hair Curler	160	
188	Sonar Hair Straightener	120
189	Square Octobudies	20	
190	Srawberry Body Scrub	40	
191	St Ives Oatmeal And Sheabutter Body wash	110	
192	St. Ives Blemish Control (apricot scrub)	90	
193	St. Ives Exfoliating Body Wash	110	
194	St. Ives Fresh Skin Scrub	85	
195	St. Ives Gentle Smoothing Scrub(Oat)	85
196	St. Ives Hydrating Body Wash	110
197	St. Ives Radiant Skin Scrub	85
198	Star Pimple Patches	15.00	
199	Sugar Lip Scrub	45.00	
200	Sunburns and Darkspots Skincare Set	265
201	Sweet Dose Keyholder Lipgloss	30.00	
202	Tea Tree Acne Patch	35	
203	Tea Tree Conditioner 50	
204	Tea Tree Facial Scrub 45	
205	Tea Tree Facial Set	200	
206	Tea Tree Facial Toner	45	
207	Tea Tree Oil	55	
208	Tea Tree Shampoo	50	
209	The Estelin Rosehip Niacinamide Fade Spot Serum 70	
210	Tretinoin Gel 0.1%	120	
211	USHAS Lip mask and Scrub Combo	30	
212	USHAS This is Juice Gloss	12	
213	Ushas Colour Lip Gloss	12.00	
214	Ushas Setting Spray	40.00	
215	Vapourizer For Skincare(Comes with a Charger)	50	
216	Veet Tumeric Oil(Small size) 70
`

// -----------------------------------------------------------------------------
// 2. Parse the raw list into [{ row, name, price }, ...]
// -----------------------------------------------------------------------------
function parseList(raw) {
  const items = []
  const ambiguous = []
  for (const line of raw.split("\n")) {
    const t = line.replace(/\r/g, "").trim()
    if (!t) continue
    // Split by tabs first
    const parts = t.split("\t").map((p) => p.trim()).filter((p) => p.length > 0)
    // Drop the leading row index (first numeric token)
    let working = [...parts]
    if (working.length && /^\d+$/.test(working[0])) working.shift()
    if (working.length === 0) continue

    const rowIdx = parts[0]
    let name = working[0]
    let priceStr = working[1] // might be undefined

    // If priceStr is missing or not a number, try to extract trailing number from name
    if (!priceStr || !/^\d+(?:\.\d+)?$/.test(priceStr.replace(/\s+/g, ""))) {
      const m = name.match(/^(.*?)[\s]+(\d+(?:\.\d+)?)\s*$/)
      if (m) {
        name = m[1].trim()
        priceStr = m[2]
      } else {
        ambiguous.push({ row: rowIdx, line: t })
        continue
      }
    }

    const price = Number(String(priceStr).replace(/\s+/g, ""))
    if (!Number.isFinite(price)) {
      ambiguous.push({ row: rowIdx, line: t })
      continue
    }

    items.push({ row: rowIdx, name: name.trim(), price })
  }
  return { items, ambiguous }
}

// -----------------------------------------------------------------------------
// 3. Normalize names for matching (case/punct/whitespace-insensitive)
// -----------------------------------------------------------------------------
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

// -----------------------------------------------------------------------------
// 4. Env loader (same pattern as other scripts)
// -----------------------------------------------------------------------------
function loadDotEnv() {
  const paths = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
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

// -----------------------------------------------------------------------------
// 5. Main
// -----------------------------------------------------------------------------
async function main() {
  loadDotEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const apply = process.argv.includes("--apply")

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { items, ambiguous } = parseList(RAW_LIST)
  console.log(`Parsed ${items.length} priced items from input list (${ambiguous.length} ambiguous).`)
  if (ambiguous.length) {
    console.log("\nAmbiguous lines (could not extract a price):")
    for (const a of ambiguous) console.log(`  [#${a.row}] ${a.line}`)
  }

  // Fetch all products and their variants
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, variants(id, price)")

  if (error) {
    console.error("Failed to fetch products:", error)
    process.exit(1)
  }
  console.log(`Fetched ${products.length} products from DB.\n`)

  // Build lookup: normalized-name -> array of products (handles dupes)
  const byNorm = new Map()
  for (const p of products) {
    const k = normalize(p.name)
    if (!byNorm.has(k)) byNorm.set(k, [])
    byNorm.get(k).push(p)
  }

  // Match each list item
  const matched = []
  const unmatched = []
  const usedIds = new Set()

  for (const it of items) {
    const k = normalize(it.name)
    let candidates = byNorm.get(k) || []
    if (candidates.length === 0) {
      // Loose fallback: substring match on either side
      const looseHits = []
      for (const p of products) {
        const np = normalize(p.name)
        if (np === k) continue
        if (np.includes(k) || k.includes(np)) {
          looseHits.push(p)
        }
      }
      candidates = looseHits
    }
    if (candidates.length === 0) {
      unmatched.push(it)
      continue
    }
    // Pick first not-yet-used candidate
    const pick = candidates.find((c) => !usedIds.has(c.id)) || candidates[0]
    usedIds.add(pick.id)
    matched.push({ list: it, db: pick })
  }

  // Products in DB that didn't match any list entry
  const dbOnly = products.filter((p) => !usedIds.has(p.id))

  console.log(`MATCHED:    ${matched.length}`)
  console.log(`UNMATCHED:  ${unmatched.length} (in your list but not found in DB)`)
  console.log(`DB-ONLY:    ${dbOnly.length} (in DB but not in your list)`)
  console.log("")

  // Show preview of price changes
  console.log("=== PRICE CHANGE PREVIEW ===")
  let changed = 0
  let same = 0
  for (const m of matched) {
    const oldP = Number(m.db.price)
    const newP = m.list.price
    const variantPrices = (m.db.variants || []).map((v) => Number(v.price))
    const variantInfo = variantPrices.length
      ? ` | variants: [${variantPrices.join(", ")}]`
      : ""
    const flag = oldP === newP ? "  ==" : "  ->"
    if (oldP !== newP) changed++
    else same++
    console.log(
      `  ${flag} ${m.db.name}: GH₵${isFinite(oldP) ? oldP : "?"} -> GH₵${newP}${variantInfo}`,
    )
  }
  console.log(`\n  ${changed} products will change, ${same} are already correct.`)

  if (unmatched.length) {
    console.log("\n=== UNMATCHED (will be skipped) ===")
    for (const u of unmatched) console.log(`  [#${u.row}] "${u.name}" (intended price GH₵${u.price})`)
  }

  if (dbOnly.length) {
    console.log("\n=== DB-ONLY (no price change for these) ===")
    for (const p of dbOnly) console.log(`  "${p.name}" (current GH₵${p.price ?? "null"})`)
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing was changed. Re-run with --apply to commit changes.")
    return
  }

  // -------------------------------------------------------------------------
  // Apply updates
  // -------------------------------------------------------------------------
  console.log("\nApplying updates...")
  let okProducts = 0
  let okVariants = 0
  const errors = []

  for (const m of matched) {
    const { error: pErr } = await supabase
      .from("products")
      .update({ price: m.list.price, updated_at: new Date().toISOString() })
      .eq("id", m.db.id)
    if (pErr) {
      errors.push(`products[${m.db.name}]: ${pErr.message}`)
      continue
    }
    okProducts++

    if (m.db.variants && m.db.variants.length > 0) {
      const { error: vErr } = await supabase
        .from("variants")
        .update({ price: m.list.price, updated_at: new Date().toISOString() })
        .eq("product_id", m.db.id)
      if (vErr) {
        errors.push(`variants[${m.db.name}]: ${vErr.message}`)
        continue
      }
      okVariants += m.db.variants.length
    }
  }

  console.log(`\nUpdated ${okProducts} products and ${okVariants} variants.`)
  if (errors.length) {
    console.log(`\n${errors.length} error(s):`)
    for (const e of errors) console.log("  - " + e)
    process.exit(1)
  }
  console.log("Done.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
