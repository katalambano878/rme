import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { listStockFromProduct } from "@/lib/product-metrics"
import { generateOrderNumber } from "@/lib/utils"
import { effectivePriceForProduct, effectivePriceForVariant, parseStorePricing, withResolvedSalePrice, type StorePricing } from "@/lib/effective-price"
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTACT_EMAIL,
  PHONE_DISPLAY_PRIMARY,
  PHONE_INTERNATIONAL_PRIMARY,
  WHATSAPP_URL,
} from "@/lib/brand"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatProduct = {
  id: string
  name: string
  slug: string
  price: number
  image: string
  quantity: number
  maxStock: number
  moq: number
  inStock: boolean
  /** Short plain-text description, for the assistant to explain a pick. */
  summary?: string
}

export type ChatOrder = {
  id: string
  order_number: string
  status: string
  payment_status: string
  total: number
  created_at: string
  tracking_number?: string
  items: { name: string; quantity: number; price: number }[]
}

export type ChatCoupon = {
  valid: boolean
  code: string
  reason?: string
  type?: string
  value?: number
  minimum_purchase?: number
  maximum_discount?: number
  expires?: string
}

export type ChatTicket = {
  id: string
  ticket_number: number
  status: string
  subject: string
}

export type ChatReturn = {
  id: string
  status: string
  order_number: string
  reason: string
}

export type ChatCustomerProfile = {
  name: string
  email: string
  total_orders: number
  total_spent: number
  last_order_at: string | null
}

// Row shapes read through PRODUCT_SELECT / order selects (supabase-js returns
// these untyped, so they are described here for the mapping code).
type ChatVariantRow = {
  id: string
  sku?: string | null
  price: number | string | null
  sale_price?: number | string | null
  compare_at_price?: number | string | null
  stock_quantity?: number | string | null
}

type ChatProductRow = {
  id: string
  name: string
  slug: string
  price?: number | string | null
  sale_price?: number | string | null
  compare_at_price?: number | string | null
  quantity?: number | string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  variants?: ChatVariantRow[] | null
  product_images?: { url: string; sort_order?: number | null }[] | null
}

type ChatOrderItemRow = {
  name_snapshot?: string | null
  quantity: number
  unit_price?: number | string | null
}

type PaymentStatusRow = { status?: string | null }

const PRODUCT_SELECT = `
  id, name, slug, status, description, price, sale_price, compare_at_price, quantity, metadata,
  variants(id, sku, price, sale_price, compare_at_price, stock_quantity),
  product_images(url, sort_order)
`

// Chat tool prices are read by anonymous users, so the global "sale promotion
// enabled" toggle should apply here too — exactly like the storefront.
async function fetchSaleEnabled(client: SupabaseClient): Promise<StorePricing> {
  try {
    const { data } = await client
      .from("site_settings")
      .select("feature_flags")
      .eq("id", 1)
      .maybeSingle()
    return parseStorePricing(data?.feature_flags)
  } catch {
    return { salesActive: false, discountPercent: 0, strictDiscount: false }
  }
}

function aggregateProductPricing(p: ChatProductRow, saleEnabled: StorePricing | boolean) {
  const priced = withResolvedSalePrice(p)
  const list = Array.isArray(priced?.variants) ? priced.variants : []
  const pricing = effectivePriceForProduct(priced, saleEnabled)
  return {
    stock: listStockFromProduct(p),
    price: pricing.effective,
    firstVariant: list[0] || null,
  }
}

function mapProduct(p: ChatProductRow, saleEnabled: StorePricing | boolean): ChatProduct {
  const { stock, price } = aggregateProductPricing(p, saleEnabled)
  const images = [...(p.product_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const moq = 1
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price,
    image: images[0]?.url || "",
    quantity: stock,
    maxStock: stock,
    moq,
    inStock: stock >= moq,
    summary: plainText(p.description).slice(0, 220) || undefined,
  }
}

function paidFromPayments(payments: PaymentStatusRow[] | null | undefined) {
  const list = payments || []
  return list.some((p) => p.status === "paid" || p.status === "completed")
}

// ─── 1. Search Products ───────────────────────────────────────────────────────

// Words that carry no product meaning ("can you find me something for…").
const SEARCH_STOPWORDS = new Set(
  `a an and any are as at be best buy can could do does for from get give good have help how i i'm im in is it
  its like looking me my need of on or please product products put recommend set show skin skincare so some
  something suggest that the this to together use want what which with would you your yours really very also
  get got one ones thing things type kind`.split(/\s+/),
)

/**
 * Make free text safe to drop into a PostgREST `or()` filter: commas, brackets,
 * wildcards and quotes would otherwise split or break the filter string.
 */
export function cleanSearchText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'+&-]/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function searchKeywords(term: string): string[] {
  const words = cleanSearchText(term)
    .split(" ")
    .map((w) => w.replace(/^[-+&]+|[-+&]+$/g, ""))
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w))
  return [...new Set(words)].slice(0, 6)
}

function plainText(html: unknown): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreRow(row: ChatProductRow, words: string[]): number {
  const name = (row.name || "").toLowerCase()
  const desc = plainText(row.description).toLowerCase()
  let score = 0
  for (const w of words) {
    if (name.includes(w)) score += 3
    else if (desc.includes(w)) score += 1
  }
  return score
}

/** Best matches first, in-stock items ahead of sold-out ones. */
function rankProducts(rows: ChatProductRow[], words: string[], saleEnabled: StorePricing, limit: number) {
  const seen = new Set<string>()
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({ p: mapProduct(r, saleEnabled), score: scoreRow(r, words) }))
    .sort((x, y) => Number(y.p.inStock) - Number(x.p.inStock) || y.score - x.score || x.p.name.localeCompare(y.p.name))
    .slice(0, limit)
    .map((x) => x.p)
}

export async function searchProducts(supabase: SupabaseClient, query: string, limit = 4): Promise<ChatProduct[]> {
  const term = cleanSearchText(query)
  if (!term) return []

  const saleEnabled = await fetchSaleEnabled(supabase)
  const words = searchKeywords(term)

  // 1. The whole phrase ("vitamin c serum")
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
    .limit(limit * 4)

  if (error) console.error("[ChatTools] searchProducts error:", error)
  if (data && data.length > 0) {
    return rankProducts(data as ChatProductRow[], words.length ? words : [term], saleEnabled, limit)
  }

  // 2. Individual meaningful words ("I have oily skin, what cleanser?" → oily, cleanser),
  //    ranked by how many of them each product matches.
  if (words.length > 0) {
    const results = await Promise.all(
      words.map((w) =>
        supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .eq("status", "active")
          .or(`name.ilike.%${w}%,description.ilike.%${w}%`)
          .limit(40),
      ),
    )
    const rows = results.flatMap((r) => (r.data as ChatProductRow[] | null) ?? [])
    if (rows.length > 0) {
      const ranked = rankProducts(rows, words, saleEnabled, limit)
      if (ranked.length > 0) return ranked
    }
  }

  // 3. A category name ("lip care", "sunscreen")
  for (const w of [term, ...words]) {
    const { data: catMatch } = await supabase
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .ilike("name", `%${w}%`)
      .limit(1)
    if (catMatch && catMatch.length > 0) {
      const { data: catProducts } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .eq("category_id", catMatch[0].id)
        .limit(limit * 4)
      if (catProducts && catProducts.length > 0) {
        return rankProducts(catProducts as ChatProductRow[], words, saleEnabled, limit)
      }
    }
  }

  return []
}

// ─── 1b. Skincare routine builder ─────────────────────────────────────────────

export type SkinType = "oily" | "dry" | "combination" | "sensitive" | "normal"
export type SkinConcern = "acne" | "dark_spots" | "dullness" | "aging" | "dryness" | "oiliness" | "sensitivity"

export type RoutineStep = {
  step: string
  when: string
  why: string
  products: ChatProduct[]
}

export type SkinRoutine = {
  skinType: SkinType
  concerns: SkinConcern[]
  steps: RoutineStep[]
  readySets: ChatProduct[]
  tips: string[]
}

const SKIN_TYPE_WORDS: Record<SkinType, string[]> = {
  oily: ["oily", "oil control", "oil-control", "oil free", "mattif", "pore", "salicylic", "niacinamide", "tea tree", "foam", "gel", "clarif", "acne"],
  dry: ["dry", "hydrat", "hyaluronic", "ceramide", "moistur", "nourish", "cream", "shea", "glycerin", "milk"],
  combination: ["combination", "balanc", "niacinamide", "hydrat", "gel", "ceramide", "gentle"],
  sensitive: ["sensitive", "gentle", "sooth", "calm", "centella", "cica", "aloe", "ceramide", "simple", "fragrance"],
  normal: ["all skin", "hydrat", "gentle", "vitamin c", "glow", "ceramide"],
}

const CONCERN_WORDS: Record<SkinConcern, string[]> = {
  acne: ["acne", "blemish", "salicylic", "tea tree", "breakout", "pimple", "spot treatment", "clear"],
  dark_spots: ["dark spot", "hyperpig", "brighten", "vitamin c", "kojic", "arbutin", "niacinamide", "turmeric", "even tone", "tumeric"],
  dullness: ["glow", "radian", "brighten", "vitamin c", "rice", "luminous"],
  aging: ["collagen", "retinol", "peptide", "firm", "wrinkle", "anti-aging", "anti aging", "pdrn", "rejuven"],
  dryness: ["dry", "hydrat", "hyaluronic", "ceramide", "moistur"],
  oiliness: ["oil control", "oily", "mattif", "pore", "salicylic", "niacinamide"],
  sensitivity: ["sensitive", "sooth", "calm", "centella", "cica", "gentle", "aloe"],
}

// Words that point at the opposite skin type — a dry-skin routine shouldn't
// suggest an "oil control" set, and an oily one shouldn't suggest a rich cream.
const SKIN_TYPE_AVOID: Record<SkinType, string[]> = {
  oily: ["dry skin", "rich cream", "very dry", "butter"],
  dry: ["oil control", "oil-control", "oily", "mattif", "acne control"],
  combination: [],
  sensitive: ["peel", "glycolic", "scrub", "exfoliat"],
  normal: [],
}

// Words that mean a product is for a different job (kids, body, hair, lips…).
const ROUTINE_EXCLUDE = ["kids", "baby", "body", "hair", "lip ", "lips", "eye patch", "underarm", "feminine"]

const ROUTINE_STEPS: { key: string; step: string; category: string; when: string; why: Record<SkinType, string> }[] = [
  {
    key: "cleanser",
    step: "Cleanser",
    category: "facial cleansers",
    when: "Morning and night",
    why: {
      oily: "A foaming or gel cleanser lifts excess oil and sweat without stripping your skin.",
      dry: "A gentle, creamy cleanser cleans without leaving your skin tight.",
      combination: "A gentle gel cleanser clears the oily T-zone without drying your cheeks.",
      sensitive: "A mild, soothing cleanser keeps irritation down.",
      normal: "A gentle daily cleanser keeps your skin clear and balanced.",
    },
  },
  {
    key: "toner",
    step: "Toner",
    category: "facial toners",
    when: "After cleansing",
    why: {
      oily: "An oil-control or salicylic toner helps keep pores clear and shine down.",
      dry: "A hydrating toner adds a first layer of moisture.",
      combination: "A balancing toner evens out oily and dry areas.",
      sensitive: "A soothing, alcohol-free toner calms the skin.",
      normal: "A toner preps your skin so serums sink in better.",
    },
  },
  {
    key: "serum",
    step: "Serum",
    category: "facial serums",
    when: "After toner",
    why: {
      oily: "Niacinamide-type serums help control oil and fade marks.",
      dry: "A hyaluronic or hydrating serum pulls moisture into the skin.",
      combination: "A light serum treats your main concern without heaviness.",
      sensitive: "A calming serum strengthens the skin barrier.",
      normal: "A serum targets glow and even tone.",
    },
  },
  {
    key: "moisturizer",
    step: "Moisturiser",
    category: "facial moisturizers",
    when: "Morning and night",
    why: {
      oily: "Oily skin still needs moisture — a light, oil-free one stops your skin over-producing oil.",
      dry: "A richer cream locks in moisture all day.",
      combination: "A lightweight moisturiser hydrates without clogging the T-zone.",
      sensitive: "A gentle, barrier-repair moisturiser keeps skin comfortable.",
      normal: "A daily moisturiser keeps skin soft and protected.",
    },
  },
  {
    key: "sunscreen",
    step: "Sunscreen",
    category: "sunscreen",
    when: "Every morning, last step",
    why: {
      oily: "A light, non-greasy SPF protects without the shine — and stops dark marks getting darker.",
      dry: "SPF protects your skin and keeps dark spots from deepening.",
      combination: "A light SPF protects without feeling heavy.",
      sensitive: "Sun protection prevents irritation and dark spots.",
      normal: "Daily SPF is the best way to keep skin even and healthy in the Accra sun.",
    },
  },
]

const ROUTINE_TIPS: Record<SkinType, string[]> = {
  oily: [
    "Don't skip moisturiser — drying oily skin out makes it produce more oil.",
    "Wash your face twice a day, not more; over-washing triggers more oil.",
    "Use sunscreen daily, even indoors near windows.",
  ],
  dry: [
    "Apply moisturiser on slightly damp skin to lock in water.",
    "Avoid very hot water when washing your face.",
    "Use sunscreen daily.",
  ],
  combination: [
    "You can use a lighter moisturiser on the T-zone and a little more on dry areas.",
    "Introduce one new product at a time.",
    "Use sunscreen daily.",
  ],
  sensitive: [
    "Patch-test new products on your jaw or behind your ear for 24 hours first.",
    "Introduce one new product a week.",
    "Use sunscreen daily.",
  ],
  normal: [
    "Consistency beats lots of products — keep it simple.",
    "Use sunscreen daily.",
  ],
}

const CONCERN_TIPS: Partial<Record<SkinConcern, string>> = {
  acne: "Don't pick or squeeze spots — it leaves dark marks. Give acne products 4–6 weeks.",
  dark_spots: "Dark spots fade slowly (6–8 weeks) and sunscreen is what keeps them from coming back.",
  aging: "Use retinol-type products at night only, and start 2–3 nights a week.",
  sensitivity: "Avoid scrubs and strong acids until your skin calms down.",
}

/** Spot a skin type and concerns in a customer's own words. */
export function detectSkinProfile(text: string): { skinType: SkinType | null; concerns: SkinConcern[] } {
  const t = (text || "").toLowerCase()
  let skinType: SkinType | null = null
  if (/combination|combo skin|oily t-?zone/.test(t)) skinType = "combination"
  else if (/oily|greasy|shiny|too much oil/.test(t)) skinType = "oily"
  else if (/\bdry\b|flaky|tight skin|dehydrated/.test(t)) skinType = "dry"
  else if (/sensitive|irritat|reacts|redness|burns easily/.test(t)) skinType = "sensitive"
  else if (/normal skin/.test(t)) skinType = "normal"

  const concerns: SkinConcern[] = []
  if (/acne|pimple|breakout|blemish|spots on my face|whitehead|blackhead/.test(t)) concerns.push("acne")
  if (/dark spot|dark mark|hyperpig|uneven|discolou?r|patches|marks/.test(t)) concerns.push("dark_spots")
  if (/dull|glow|radian|bright/.test(t)) concerns.push("dullness")
  if (/wrinkle|fine line|aging|ageing|firm|sagg/.test(t)) concerns.push("aging")
  if (skinType && skinType !== "sensitive" && /sensitive|irritat|redness/.test(t)) concerns.push("sensitivity")
  if (skinType === "oily" && concerns.length === 0 && /shine|shiny|pores/.test(t)) concerns.push("oiliness")
  return { skinType, concerns }
}

/** True when the message is asking for skincare advice or a routine. */
export function looksLikeSkincareQuestion(text: string): boolean {
  const t = (text || "").toLowerCase()
  const profile = detectSkinProfile(t)
  if (profile.skinType || profile.concerns.length) return true
  if (/^\W*(skin ?care|routine|skin)\W*$/.test(t)) return true
  return /routine|skin ?care (set|advice|help)|regimen|what should i (use|get|buy)|my skin|my face|face (care|products)/.test(t)
}

/**
 * Build a full routine (cleanser → toner → serum → moisturiser → sunscreen)
 * from what the store actually stocks, picking the best match for the skin
 * type and concerns at each step, plus any ready-made sets that fit.
 */
export async function buildSkincareRoutine(
  supabase: SupabaseClient,
  input: { skinType?: string | null; concerns?: string[] | null; maxPrice?: number | null },
): Promise<SkinRoutine> {
  const skinType: SkinType = (Object.keys(SKIN_TYPE_WORDS) as SkinType[]).includes(input.skinType as SkinType)
    ? (input.skinType as SkinType)
    : "normal"
  const concerns = (input.concerns || []).filter((c): c is SkinConcern => c in CONCERN_WORDS).slice(0, 3)
  const maxPrice = Number(input.maxPrice) > 0 ? Number(input.maxPrice) : null

  const words = [...SKIN_TYPE_WORDS[skinType], ...concerns.flatMap((c) => CONCERN_WORDS[c])]
  // Concern words count double: they are what the customer is most worried about.
  const concernWords = new Set(concerns.flatMap((c) => CONCERN_WORDS[c]))

  const saleEnabled = await fetchSaleEnabled(supabase)
  const { data: cats } = await supabase.from("categories").select("id, name").eq("is_active", true)
  const catList = (cats || []) as { id: string; name: string }[]
  const catId = (needle: string) => catList.find((c) => c.name.toLowerCase().includes(needle))?.id
  const stepCats = ROUTINE_STEPS.map((s) => catId(s.category))
  const setCat = catId("skin care set") || catId("skincare set")
  const ids = [...stepCats, setCat].filter((x): x is string => !!x)

  let rows: (ChatProductRow & { category_id?: string })[] = []
  if (ids.length) {
    const { data, error } = await supabase
      .from("products")
      .select(`category_id, ${PRODUCT_SELECT}`)
      .eq("status", "active")
      .in("category_id", ids)
      .limit(600)
    if (error) console.error("[ChatTools] buildSkincareRoutine error:", error)
    rows = (data || []) as typeof rows
  }

  const score = (r: ChatProductRow) => {
    const name = (r.name || "").toLowerCase()
    const desc = plainText(r.description).toLowerCase()
    if (ROUTINE_EXCLUDE.some((x) => name.includes(x))) return -100
    let s = 0
    for (const w of SKIN_TYPE_AVOID[skinType]) if (name.includes(w)) s -= 6
    for (const w of words) {
      const weight = concernWords.has(w) ? 2 : 1
      if (name.includes(w)) s += 3 * weight
      else if (desc.includes(w)) s += 1 * weight
    }
    return s
  }

  const pick = (categoryId: string | undefined, n: number) =>
    rows
      .filter((r) => r.category_id === categoryId)
      .map((r) => ({ p: mapProduct(r, saleEnabled), s: score(r) }))
      .filter((x) => x.p.inStock && x.s > -100 && (!maxPrice || x.p.price <= maxPrice))
      .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
      .slice(0, n)
      .map((x) => x.p)

  const steps: RoutineStep[] = ROUTINE_STEPS.map((s, i) => ({
    step: s.step,
    when: s.when,
    why: s.why[skinType],
    products: pick(stepCats[i], 2),
  })).filter((s) => s.products.length > 0)

  const readySets = setCat
    ? rows
        .filter((r) => r.category_id === setCat)
        .map((r) => ({ p: mapProduct(r, saleEnabled), s: score(r) }))
        .filter((x) => x.p.inStock && x.s >= 4 && (!maxPrice || x.p.price <= maxPrice * 3))
        .sort((a, b) => b.s - a.s)
        .slice(0, 2)
        .map((x) => x.p)
    : []

  const tips = [...ROUTINE_TIPS[skinType]]
  for (const c of concerns) if (CONCERN_TIPS[c]) tips.unshift(CONCERN_TIPS[c]!)

  return { skinType, concerns, steps, readySets, tips: tips.slice(0, 4) }
}

const CONCERN_LABEL: Record<SkinConcern, string> = {
  acne: "acne",
  dark_spots: "dark spots",
  dullness: "dull skin",
  aging: "fine lines",
  dryness: "dryness",
  oiliness: "oiliness",
  sensitivity: "sensitivity",
}

/** How to use a routine — answers "How do I use these?" without an AI model. */
export const ROUTINE_HOW_TO = [
  "Here's how to use your routine:",
  "",
  "**Morning:** cleanser → toner → serum → moisturiser → sunscreen (last, every day).",
  "**Night:** cleanser → toner → serum → moisturiser. No sunscreen at night.",
  "",
  "- Use a pea-sized amount of cream and 2–3 drops of serum.",
  "- Wait about a minute between layers so each one sinks in.",
  "- Start new products one at a time, a few days apart, so you can tell what suits you.",
  "- Patch-test first if your skin is sensitive: a little on your jaw for 24 hours.",
  "- Acids (salicylic, glycolic) and retinol: start every other night.",
  "- Give it 4–6 weeks before judging results.",
].join("\n")

/** A readable routine for when no AI model is available. */
export function formatRoutineMessage(r: SkinRoutine, money: (n: number) => string): string {
  const who = `${r.skinType} skin${r.concerns.length ? ` with ${r.concerns.map((c) => CONCERN_LABEL[c]).join(" and ")}` : ""}`
  const lines = [`Here's a simple routine for **${who}**, using products we have in stock:`, ""]
  r.steps.forEach((s, i) => {
    const names = s.products.map((p) => `${p.name.trim()} (${money(p.price)})`).join(" or ")
    lines.push(`**${i + 1}. ${s.step}** — ${s.when}`)
    lines.push(`${s.why} Try: ${names}.`)
    lines.push("")
  })
  if (r.readySets.length) {
    lines.push(`Prefer a ready-made set? ${r.readySets.map((p) => `**${p.name.trim()}** (${money(p.price)})`).join(" or ")}.`, "")
  }
  if (r.tips.length) {
    lines.push("**Tips**")
    r.tips.forEach((t) => lines.push(`- ${t}`))
  }
  return lines.join("\n").trim()
}

/** Products by id, live (current price and stock), in the order given. */
export async function getProductsByIds(supabase: SupabaseClient, ids: string[]): Promise<ChatProduct[]> {
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20)
  if (!clean.length) return []
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").in("id", clean)
  if (error || !data) return []
  const saleEnabled = await fetchSaleEnabled(supabase)
  const byId = new Map((data as ChatProductRow[]).map((r) => [r.id, mapProduct(r, saleEnabled)]))
  return clean.map((id) => byId.get(id)).filter((p): p is ChatProduct => !!p)
}

// ─── 2. Get Product for Cart ────────────────────────────────────────────────

export async function getProductForCart(supabase: SupabaseClient, slugOrId: string): Promise<ChatProduct | null> {
  if (!slugOrId?.trim()) return null
  const trimmed = slugOrId.trim()
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)

  const q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active")
  const { data, error } = isId ? await q.eq("id", trimmed).single() : await q.eq("slug", trimmed).single()
  if (error || !data) return null
  const saleEnabled = await fetchSaleEnabled(supabase)
  return mapProduct(data, saleEnabled)
}

// ─── 3. Track Order ───────────────────────────────────────────────────────────

export async function trackOrder(supabase: SupabaseClient, orderNumber: string, email: string): Promise<ChatOrder | null> {
  if (!orderNumber?.trim() || !email?.trim()) return null
  const num = orderNumber.trim()
  const emailLower = email.trim().toLowerCase()

  const select = `
    id, order_number, status, grand_total, created_at, guest_email, user_id,
    payments(status),
    order_items(name_snapshot, quantity, unit_price, line_total)
  `

  let { data: row, error } = await supabase.from("orders").select(select).eq("order_number", num).maybeSingle()

  if (!row && /^[0-9a-f-]{36}$/i.test(num)) {
    const r2 = await supabase.from("orders").select(select).eq("id", num).maybeSingle()
    row = r2.data
    error = r2.error
  }

  if (error || !row) return null

  // SECURITY: Always verify email. Previous logic skipped the check when
  // guest_email was null (typical for logged-in customer orders), letting any
  // anonymous chat user retrieve another customer's order with any email.
  const guest = (row.guest_email || "").toLowerCase()
  let emailMatches = guest && guest === emailLower

  if (!emailMatches && row.user_id) {
    // For accounts: look up profile email and require an exact match.
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", row.user_id)
      .maybeSingle()
    const ownerEmail = (ownerProfile?.email || "").toLowerCase()
    emailMatches = !!ownerEmail && ownerEmail === emailLower
  }

  if (!emailMatches) return null

  const payment_status = paidFromPayments(row.payments) ? "paid" : "pending"

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    payment_status,
    total: Number(row.grand_total) || 0,
    created_at: row.created_at,
    tracking_number: undefined,
    items: (row.order_items || []).map((i: ChatOrderItemRow) => ({
      name: i.name_snapshot || "Item",
      quantity: i.quantity,
      price: Number(i.unit_price) || 0,
    })),
  }
}

// ─── 4. Get Customer Orders ───────────────────────────────────────────────────

export async function getCustomerOrders(supabase: SupabaseClient, userId: string, limit = 5): Promise<ChatOrder[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, grand_total, created_at,
      payments(status),
      order_items(name_snapshot, quantity, unit_price, line_total)
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    payment_status: paidFromPayments(o.payments) ? "paid" : "pending",
    total: Number(o.grand_total) || 0,
    created_at: o.created_at,
    tracking_number: undefined,
    items: (o.order_items || []).map((i: ChatOrderItemRow) => ({
      name: i.name_snapshot || "Item",
      quantity: i.quantity,
      price: Number(i.unit_price) || 0,
    })),
  }))
}

// ─── 5. Check Coupon ──────────────────────────────────────────────────────────

export async function checkCoupon(supabase: SupabaseClient, code: string, cartTotal?: number): Promise<ChatCoupon> {
  const trimmed = (code || "").trim().toUpperCase()
  if (!trimmed) return { valid: false, code: trimmed, reason: "No code provided." }

  const { data, error } = await supabase.from("discounts").select("*").ilike("code", trimmed).maybeSingle()
  if (error || !data) {
    return { valid: false, code: trimmed, reason: "This coupon code does not exist." }
  }

  const isActive = data.is_active !== false && data.is_active !== "false"
  const now = new Date()
  const start = data.starts_at ? new Date(data.starts_at) : null
  const end = data.ends_at ? new Date(data.ends_at) : null
  const usageLimit = data.max_uses
  const usageCount = Number(data.uses_count ?? 0)

  const minPurchase = Number(data.min_spend ?? 0) || 0
  const dt = data.discount_type as string
  const type =
    dt === "percent" ? "percentage" : dt === "fixed" ? "fixed" : dt === "free_shipping" ? "free_shipping" : dt || "percentage"
  const value = Number(data.value ?? 0)
  const maxDisc = undefined

  if (!isActive) return { valid: false, code: trimmed, reason: "This coupon is no longer active." }
  if (start && start > now) return { valid: false, code: trimmed, reason: "This coupon is not yet valid." }
  if (end && end < now) return { valid: false, code: trimmed, reason: "This coupon has expired." }
  if (usageLimit != null && usageCount >= Number(usageLimit)) {
    return { valid: false, code: trimmed, reason: "This coupon has reached its usage limit." }
  }
  if (cartTotal !== undefined && minPurchase > 0 && cartTotal < minPurchase) {
    return {
      valid: false,
      code: trimmed,
      reason: `Minimum purchase of GH₵${minPurchase.toFixed(2)} required.`,
    }
  }

  return {
    valid: true,
    code: trimmed,
    type,
    value,
    minimum_purchase: minPurchase || undefined,
    maximum_discount: maxDisc,
    expires: data.ends_at || undefined,
  }
}

// ─── 6. Create Support Ticket ────────────────────────────────────────────────

export async function createSupportTicket(
  supabase: SupabaseClient,
  params: { userId?: string; email: string; subject: string; description: string; category?: string },
): Promise<ChatTicket | null> {
  const { userId, email, subject, description, category } = params
  if (!email || !subject || !description) return null

  try {
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId || null,
        email,
        subject,
        description,
        category: category || "other",
        status: "open",
        priority: "medium",
      })
      .select("id, ticket_number, status, subject")
      .single()

    if (error || !ticket) {
      console.error("[ChatTools] createSupportTicket error:", error)
      return null
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      user_id: userId || null,
      message: description,
      is_internal: false,
    })

    return {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      subject: ticket.subject,
    }
  } catch (e) {
    console.error("[ChatTools] createSupportTicket:", e)
    return null
  }
}

// ─── 7. Initiate Return ─────────────────────────────────────────────────────

export async function initiateReturn(
  supabase: SupabaseClient,
  params: { userId: string; orderId: string; reason: string; description: string },
): Promise<ChatReturn | null> {
  const { userId, orderId, reason, description } = params
  if (!userId || !orderId) return null

  try {
    const { data: order } = await supabase.from("orders").select("id, order_number, status, created_at, user_id").eq("id", orderId).single()
    if (!order || order.user_id !== userId || order.status !== "delivered") return null

    const deliveredDate = new Date(order.created_at)
    const daysSince = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 30) return null

    const { data: ret, error } = await supabase
      .from("return_requests")
      .insert({
        order_id: orderId,
        user_id: userId,
        reason,
        description,
        status: "pending",
      })
      .select("id, status")
      .single()

    if (error || !ret) {
      console.error("[ChatTools] initiateReturn error:", error)
      return null
    }

    return { id: ret.id, status: ret.status, order_number: order.order_number, reason }
  } catch (e) {
    console.error("[ChatTools] initiateReturn:", e)
    return null
  }
}

// ─── 8. Get Recommendations ───────────────────────────────────────────────────

export async function getRecommendations(supabase: SupabaseClient, context?: string): Promise<ChatProduct[]> {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active")
  const ctx = cleanSearchText(context || "")
  if (ctx) {
    q = q.or(`name.ilike.%${ctx}%,description.ilike.%${ctx}%`)
  }
  const { data, error } = await q.order("rating_avg", { ascending: false }).order("review_count", { ascending: false }).limit(8)

  if (error || !data) return []
  const saleEnabled = await fetchSaleEnabled(supabase)
  const mapped = data.map((p: ChatProductRow) => mapProduct(p, saleEnabled)).filter((p: ChatProduct) => p.inStock)
  return mapped.slice(0, 4)
}

// ─── 9. Get Store Info ───────────────────────────────────────────────────────

const STORE_INFO: Record<string, string> = {
  shipping: `We deliver across Ghana. Fees and timing are shown at checkout. See ${CONTACT_EMAIL} or our Shipping policy page for details.`,
  returns: `We accept returns in line with our Returns policy. Visit /policies/returns on the site or ask us to open a support ticket.`,
  payment: `We accept Mobile Money (MTN, Telecel, AirtelTigo) through Moolre, in GHS.`,
  contact: `Reach ${BRAND_NAME}:\n- Email: ${CONTACT_EMAIL}\n- Phone: ${PHONE_DISPLAY_PRIMARY} (${PHONE_INTERNATIONAL_PRIMARY})\n- WhatsApp: ${WHATSAPP_URL}`,
  about: `${BRAND_NAME} — ${BRAND_TAGLINE}. We offer beauty, skincare, body care, makeup, hair, and baby essentials.`,
  delivery_times: `Delivery estimates depend on your location and are confirmed at checkout.`,
  hours: `Shop online anytime. For fastest help, use this chat or WhatsApp.`,
}

export function getStoreInfo(topic: string): string {
  const key = (topic || "").toLowerCase().replace(/[^a-z_]/g, "")
  const match = Object.keys(STORE_INFO).find((k) => key.includes(k))
  if (match) return STORE_INFO[match]
  return Object.values(STORE_INFO).join("\n\n")
}

// ─── 10. Get Customer Profile ────────────────────────────────────────────────

export async function getCustomerProfile(supabase: SupabaseClient, userId: string): Promise<ChatCustomerProfile | null> {
  if (!userId) return null

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single()
  if (!profile) return null

  const { data: orders } = await supabase
    .from("orders")
    .select("grand_total, created_at, payments(status)")
    .eq("user_id", userId)

  let totalSpent = 0
  let orderCount = 0
  let lastAt: string | null = null
  for (const o of orders || []) {
    if (paidFromPayments(o.payments)) {
      totalSpent += Number(o.grand_total) || 0
      orderCount++
      if (!lastAt || o.created_at > lastAt) lastAt = o.created_at
    }
  }

  return {
    name: profile.full_name || profile.email?.split("@")[0] || "Customer",
    email: profile.email || "",
    total_orders: orderCount,
    total_spent: totalSpent,
    last_order_at: lastAt,
  }
}

// ─── 11. Create Order from Chat ───────────────────────────────────────────────

export type ChatOrderResult = {
  success: boolean
  orderNumber?: string
  total?: number
  paymentUrl?: string
  message: string
}

interface ChatOrderItem {
  productId: string
  quantity: number
}

interface ChatShippingInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  region: string
}

// Shipping is confirmed by the store after order — never charge at chat checkout.
const DELIVERY_COSTS: Record<string, number> = {
  standard: 0,
  express: 0,
  pickup: 0,
}

const MAX_ITEMS_PER_ORDER = 20
const MAX_QUANTITY_PER_ITEM = 10
const MAX_FIELD_LENGTH = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+\-() ]{7,20}$/

const orderRateMap = new Map<string, { count: number; resetAt: number }>()
const ORDER_RATE_LIMIT = 3
const ORDER_RATE_WINDOW_MS = 300_000

function checkOrderRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = orderRateMap.get(key)
  if (!entry || now > entry.resetAt) {
    orderRateMap.set(key, { count: 1, resetAt: now + ORDER_RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= ORDER_RATE_LIMIT) return false
  entry.count++
  return true
}

function sanitize(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, MAX_FIELD_LENGTH)
}

export async function createChatOrder(
  supabaseFallback: SupabaseClient,
  params: {
    items: ChatOrderItem[]
    shipping: ChatShippingInfo
    deliveryMethod: string
    paymentMethod: string
    userId?: string | null
  },
): Promise<ChatOrderResult> {
  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch {
    admin = supabaseFallback
  }

  const { items, shipping, deliveryMethod, paymentMethod, userId } = params

  if (!items?.length) {
    return { success: false, message: "No items provided. Please add products to your cart first." }
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    return { success: false, message: `Too many items. Maximum ${MAX_ITEMS_PER_ORDER} items per order.` }
  }
  if (!shipping.firstName || !shipping.lastName || !shipping.email || !shipping.phone || !shipping.address || !shipping.city || !shipping.region) {
    return {
      success: false,
      message:
        "Missing shipping information. Please provide first name, last name, email, phone, address, city, and region.",
    }
  }
  if (!EMAIL_RE.test(shipping.email)) return { success: false, message: "Please provide a valid email address." }
  if (!PHONE_RE.test(shipping.phone)) return { success: false, message: "Please provide a valid phone number." }

  for (const item of items) {
    if (!UUID_RE.test(item.productId)) {
      return { success: false, message: "Invalid product reference. Please try again." }
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return { success: false, message: `Invalid quantity. Must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` }
    }
  }

  if (!["standard", "express", "pickup"].includes(deliveryMethod)) {
    return { success: false, message: "Invalid delivery method." }
  }
  if (!["moolre", "cod"].includes(paymentMethod)) {
    return { success: false, message: "Invalid payment method." }
  }

  const rateLimitKey = shipping.email.toLowerCase().trim()
  if (!checkOrderRateLimit(rateLimitKey)) {
    return { success: false, message: "Too many orders placed recently. Please wait a few minutes before trying again." }
  }

  const sanitizedShipping: ChatShippingInfo = {
    firstName: sanitize(shipping.firstName),
    lastName: sanitize(shipping.lastName),
    email: shipping.email.toLowerCase().trim().slice(0, MAX_FIELD_LENGTH),
    phone: shipping.phone.replace(/[^0-9+\-() ]/g, "").slice(0, 20),
    address: sanitize(shipping.address),
    city: sanitize(shipping.city),
    region: sanitize(shipping.region),
  }

  const shippingCost = DELIVERY_COSTS[deliveryMethod]

  try {
    const productIds = items.map((i) => i.productId)
    const { data: products, error: prodError } = await admin
      .from("products")
      .select(PRODUCT_SELECT)
      .in("id", productIds)
      .eq("status", "active")

    if (prodError || !products?.length) {
      return { success: false, message: "Could not find the requested products. They may no longer be available." }
    }

    const productMap = new Map<string, ChatProductRow>(products.map((p: ChatProductRow) => [p.id, p]))

    const saleEnabled = await fetchSaleEnabled(admin)

    for (const item of items) {
      const p = productMap.get(item.productId)
      if (!p) return { success: false, message: `Product not found: ${item.productId}` }
      const { stock } = aggregateProductPricing(p, saleEnabled)
      if (stock < item.quantity) {
        return {
          success: false,
          message: `Sorry, "${p.name}" only has ${stock} units in stock, but you requested ${item.quantity}.`,
        }
      }
    }

    let subtotal = 0
    const lineDetails: {
      product: ChatProductRow
      variant: ChatVariantRow
      qty: number
      unit: number
    }[] = []

    for (const item of items) {
      const p = productMap.get(item.productId)!
      const vars = p.variants || []
      const sorted = [...vars].sort((a, b) => Number(a.price) - Number(b.price))
      const v = sorted[0]
      if (!v) return { success: false, message: `Product "${p.name}" has no purchasable variant.` }
      // Honor sale_price / compare_at_price the same way the storefront does,
      // so the chat customer is charged what they saw — not the original.
      const pricing = effectivePriceForVariant(v, withResolvedSalePrice(p), saleEnabled)
      const unit = pricing.effective
      if (!Number.isFinite(unit) || unit <= 0) {
        return { success: false, message: `Product "${p.name}" has no valid price.` }
      }
      subtotal += unit * item.quantity
      lineDetails.push({ product: p, variant: v, qty: item.quantity, unit })
    }

    const total = subtotal + shippingCost
    const orderNumber = generateOrderNumber()

    const shippingAddress = {
      firstName: sanitizedShipping.firstName,
      lastName: sanitizedShipping.lastName,
      address1: sanitizedShipping.address,
      address2: "",
      city: sanitizedShipping.city,
      region: sanitizedShipping.region,
      country: "Ghana",
      postalCode: "",
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: userId || null,
        guest_email: sanitizedShipping.email,
        guest_phone: sanitizedShipping.phone,
        status: "pending",
        subtotal,
        shipping_total: shippingCost,
        discount_total: 0,
        tax_total: 0,
        grand_total: total,
        currency: "GHS",
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        notes: `Chat checkout — delivery: ${deliveryMethod}, pay: ${paymentMethod === "moolre" ? "moolre (MoMo)" : paymentMethod}`,
      })
      .select("id")
      .single()

    if (orderError || !order) {
      console.error("[ChatTools] createChatOrder order insert:", orderError)
      return { success: false, message: "Failed to create order. Please try checkout on the website." }
    }

    const orderItems = lineDetails.map((row) => ({
      order_id: order.id,
      product_id: row.product.id,
      variant_id: row.variant.id,
      name_snapshot: row.product.name,
      sku_snapshot: row.variant.sku || "",
      unit_price: row.unit,
      quantity: row.qty,
      line_total: row.unit * row.qty,
    }))

    const { error: itemsError } = await admin.from("order_items").insert(orderItems)
    if (itemsError) {
      console.error("[ChatTools] order_items:", itemsError)
      return { success: false, message: "Failed to add items to order. Please try again." }
    }

    if (paymentMethod === "cod") {
      return {
        success: true,
        orderNumber,
        total,
        message: `Order ${orderNumber} placed! Total GH₵${total.toFixed(2)} (shipping confirmed by our team). Cash on delivery — our team will confirm.`,
      }
    }

    const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
      /\/+$/,
      "",
    )

    if (paymentMethod === "moolre") {
      const moolreApiUser = process.env.MOOLRE_API_USER
      const moolreApiPubkey = process.env.MOOLRE_API_PUBKEY
      const moolreAccountNumber = process.env.MOOLRE_ACCOUNT_NUMBER

      if (!moolreApiUser || !moolreApiPubkey || !moolreAccountNumber) {
        return {
          success: true,
          orderNumber,
          total,
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but Moolre is not configured. Set MOOLRE_API_USER, MOOLRE_API_PUBKEY, and MOOLRE_ACCOUNT_NUMBER.`,
        }
      }

      const uniqueRef = `${orderNumber}-R${Date.now()}`
      const payload: Record<string, unknown> = {
        type: 1,
        amount: total.toString(),
        email: process.env.MOOLRE_MERCHANT_EMAIL || sanitizedShipping.email,
        externalref: uniqueRef,
        callback: `${baseUrl}/api/payment/moolre/callback`,
        redirect: `${baseUrl}/checkout/success?order=${encodeURIComponent(orderNumber)}&payment_success=true`,
        reusable: "0",
        currency: "GHS",
        accountnumber: moolreAccountNumber,
        metadata: {
          customer_email: sanitizedShipping.email,
          original_order_number: orderNumber,
        },
      }
      if (process.env.MOOLRE_CALLBACK_SECRET) {
        payload.secret = process.env.MOOLRE_CALLBACK_SECRET
      }

      try {
        const response = await fetch("https://api.moolre.com/embed/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-USER": moolreApiUser,
            "X-API-PUBKEY": moolreApiPubkey,
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.status === 1 && result.data?.authorization_url) {
          await admin.from("payments").insert({
            order_id: order.id,
            provider: "moolre",
            provider_ref: result.data.reference || uniqueRef,
            amount: total,
            currency: "GHS",
            status: "pending",
          })

          return {
            success: true,
            orderNumber,
            total,
            paymentUrl: result.data.authorization_url,
            message: `Order ${orderNumber} is ready. Total GH₵${total.toFixed(2)}. Complete Mobile Money payment with the secure Moolre link below.`,
          }
        }

        return {
          success: true,
          orderNumber,
          total,
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but we could not open Moolre. Try paying from your order email or contact ${CONTACT_EMAIL}.`,
        }
      } catch (payErr: unknown) {
        console.error("[ChatTools] Moolre payment error:", payErr)
        return {
          success: true,
          orderNumber,
          total,
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but payment link failed. Use checkout on the site.`,
        }
      }
    }

    // Only cash on delivery and Moolre Mobile Money are accepted (checked above).
    return {
      success: true,
      orderNumber,
      total,
      message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}). Open Checkout from the site to pay with Mobile Money.`,
    }
  } catch (err: unknown) {
    console.error("[ChatTools] createChatOrder:", err)
    return { success: false, message: "Something went wrong. Please use the checkout page on the website." }
  }
}
