import type { SupabaseClient } from "@supabase/supabase-js"
import { detectSkinProfile, getProductsByIds, type ChatProduct } from "@/lib/chat-tools"

/**
 * Answer library: good general answers from the assistant are saved and
 * reused when another customer asks the same or a similar question. Reuse is
 * free (no AI call) and instant. Personal questions are never saved, and a
 * saved answer is dropped as soon as a product in it changes price or sells out.
 */

const SAVE_DAYS = 14
const MATCH_THRESHOLD = 0.55

// Different words customers use for the same thing.
const SYNONYMS: [RegExp, string][] = [
  [/\b(sets?|regimens?|routines?|kits?|combo)\b/g, "routine"],
  [/\b(moisturi[sz]ers?|face creams?|creams?|lotions?)\b/g, "moisturiser"],
  [/\b(sun ?screens?|sun ?blocks?|spf)\b/g, "sunscreen"],
  [/\b(face ?wash(es)?|cleansers?|facial wash)\b/g, "cleanser"],
  [/\b(serums?|essences?)\b/g, "serum"],
  [/\b(toners?)\b/g, "toner"],
  [/\b(pimples?|breakouts?|acnes?|blemish(es)?)\b/g, "acne"],
  [/\b(dark ?(spots?|marks?)|hyper ?pigmentation|discolou?ration|uneven tone)\b/g, "darkspots"],
  [/\b(deliver(y|ies|ing)?|shipping|ship)\b/g, "delivery"],
  [/\b(prices?|costs?|how much)\b/g, "price"],
  [/\b(oily|greasy|shiny)\b/g, "oily"],
]

const STOPWORDS = new Set(
  `a an and any are as at be been best buy can could do does doing for from get give good got have having help how i
  i'm im in is it its just kindly like looking me my need of on or please pls plz recommend show so some something
  suggest that the this to together use using want what which with would you your really very also one ones thing
  things kind type should put am will there here hello hi hey dear thanks thank sis bro madam`.split(/\s+/),
)

/** The simplified, order-free form of a question used for matching. */
export function questionKey(text: string): string {
  let t = (text || "").toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/'/g, "")
  for (const [re, word] of SYNONYMS) t = t.replace(re, ` ${word} `)
  const words = t.split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS.has(w))
  return [...new Set(words)].sort().join(" ").slice(0, 200)
}

// Anything that points at one customer's own details or account.
const PERSONAL =
  /@|\+?233|\b0\d{9}\b|\b\d{6,}\b|\bord[-\s#]?\w*\d|\b(my|our) (order|account|password|cart|bag|parcel|package|delivery|payment|refund|address|number)\b|\b(track|tracking|refund|return|cancel|password|log ?in|sign ?in|coupon|promo|voucher|discount code|checkout|paid|receipt|invoice|complain|complaint|wrong item|damaged)\b/i

/** Can this question be answered from, or saved to, the library? */
export function isLibraryQuestion(text: string): boolean {
  if (!text || text.length > 300 || PERSONAL.test(text)) return false
  return questionKey(text).split(" ").filter(Boolean).length >= 2
}

/** Tools whose answers are about one customer, so the reply must not be saved. */
const PERSONAL_TOOLS = new Set([
  "track_order",
  "get_customer_orders",
  "check_coupon",
  "create_support_ticket",
  "initiate_return",
  "create_order",
])

type SavedRow = {
  id: string
  question: string
  question_key: string
  answer: string
  product_ids: string[] | null
  product_prices: (number | string)[] | null
  quick_replies: string[] | null
  source: "ai" | "admin"
  hits: number | null
  similarity: number
}

export type LibraryAnswer = {
  id: string
  answer: string
  products: ChatProduct[]
  quickReplies: string[]
}

function sameProfile(a: string, b: string): boolean {
  const pa = detectSkinProfile(a)
  const pb = detectSkinProfile(b)
  if ((pa.skinType ?? "") !== (pb.skinType ?? "")) return false
  return [...pa.concerns].sort().join() === [...pb.concerns].sort().join()
}

function sameNumbers(a: string, b: string): boolean {
  const nums = (s: string) => (s.match(/\d+/g) || []).sort().join()
  return nums(a) === nums(b)
}

/**
 * A saved answer for this question, with its products re-checked live.
 * Returns null when there is no close, still-accurate match.
 */
export async function findLibraryAnswer(db: SupabaseClient, question: string): Promise<LibraryAnswer | null> {
  if (!isLibraryQuestion(question)) return null
  const key = questionKey(question)
  const { data, error } = await db.rpc("match_chat_answer", { p_key: key, p_threshold: MATCH_THRESHOLD })
  if (error) {
    console.warn("[AnswerLibrary] match failed:", error.message)
    return null
  }
  const rows = (Array.isArray(data) ? data : []) as SavedRow[]

  for (const row of rows) {
    // "dry skin routine" must never get the "oily skin routine" answer, and
    // "under 100" must not get the "under 200" one.
    if (!sameProfile(question, row.question) || !sameNumbers(question, row.question)) continue

    const ids = row.product_ids ?? []
    const products = ids.length ? await getProductsByIds(db, ids) : []
    if (ids.length) {
      const savedPrices = (row.product_prices ?? []).map(Number)
      const stale =
        products.length !== ids.length ||
        products.some((p, i) => !p.inStock || Math.abs(p.price - (savedPrices[i] ?? -1)) > 0.009)
      if (stale) {
        // Prices or stock moved on: an AI answer is retired (a fresh one will be
        // saved); her own edited answers stay, for her to update.
        if (row.source === "ai") await db.from("chat_answer_cache").delete().eq("id", row.id)
        continue
      }
    }

    db.from("chat_answer_cache")
      .update({ hits: (row.hits ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(({ error: e }) => e && console.warn("[AnswerLibrary] hit update failed:", e.message))

    return { id: row.id, answer: row.answer, products, quickReplies: row.quick_replies ?? [] }
  }
  return null
}

/** Save an AI answer for reuse, unless it is personal or she has her own answer for it. */
export async function saveLibraryAnswer(
  db: SupabaseClient,
  input: {
    question: string
    answer: string
    products?: ChatProduct[]
    quickReplies?: string[]
    toolsUsed: string[]
    customerName?: string | null
  },
): Promise<void> {
  const { question, answer } = input
  if (!isLibraryQuestion(question) || !answer || answer.length < 40 || answer.length > 6000) return
  if (input.toolsUsed.some((t) => PERSONAL_TOOLS.has(t))) return
  // An order number in the reply means it is about someone's order.
  if (/\bORD[-\w]*\d/i.test(answer)) return
  const first = input.customerName?.trim().split(/\s+/)[0]
  if (first && first.length > 1 && new RegExp(`\\b${first.replace(/[^a-z]/gi, "")}\\b`, "i").test(answer)) return

  const key = questionKey(question)
  const { data: existing } = await db
    .from("chat_answer_cache")
    .select("id, source")
    .eq("question_key", key)
    .maybeSingle()
  if (existing?.source === "admin") return

  const products = (input.products ?? []).slice(0, 20)
  const row = {
    question: question.slice(0, 300),
    question_key: key,
    answer,
    product_ids: products.map((p) => p.id),
    product_prices: products.map((p) => p.price),
    quick_replies: (input.quickReplies ?? []).slice(0, 4),
    source: "ai",
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + SAVE_DAYS * 86_400_000).toISOString(),
  }
  const { error } = existing
    ? await db.from("chat_answer_cache").update(row).eq("id", existing.id)
    : await db.from("chat_answer_cache").insert(row)
  if (error) console.warn("[AnswerLibrary] save failed:", error.message)
}
