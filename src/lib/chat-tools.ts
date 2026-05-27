import { createAdminClient } from "@/lib/supabase/admin"
import { listStockFromProduct } from "@/lib/product-metrics"
import { generateOrderNumber } from "@/lib/utils"
import { effectivePriceForProduct, effectivePriceForVariant } from "@/lib/effective-price"
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

const PRODUCT_SELECT = `
  id, name, slug, status, description, price, sale_price, compare_at_price, quantity,
  variants(id, sku, price, sale_price, compare_at_price, stock_quantity),
  product_images(url, sort_order)
`

// Chat tool prices are read by anonymous users, so the global "sale promotion
// enabled" toggle should apply here too — exactly like the storefront.
async function fetchSaleEnabled(client: any): Promise<boolean> {
  try {
    const { data } = await client
      .from("site_settings")
      .select("feature_flags")
      .eq("id", 1)
      .maybeSingle()
    const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {}
    return flags.sale_promotion_enabled === true
  } catch {
    return false
  }
}

function aggregateProductPricing(p: any, saleEnabled: boolean) {
  const list = Array.isArray(p?.variants) ? p.variants : []
  const pricing = effectivePriceForProduct(p, saleEnabled)
  return {
    stock: listStockFromProduct(p),
    price: pricing.effective,
    firstVariant: list[0] || null,
  }
}

function mapProduct(p: any, saleEnabled: boolean): ChatProduct {
  const { stock, price } = aggregateProductPricing(p, saleEnabled)
  const images = [...(p.product_images || [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
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
  }
}

function paidFromPayments(payments: any[] | undefined) {
  const list = payments || []
  return list.some((p) => p.status === "paid" || p.status === "completed")
}

// ─── 1. Search Products ───────────────────────────────────────────────────────

export async function searchProducts(supabase: any, query: string, limit = 4): Promise<ChatProduct[]> {
  const term = (query || "").trim()
  if (!term) return []

  const saleEnabled = await fetchSaleEnabled(supabase)

  // Try exact phrase match first
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
    .order("name")
    .limit(limit)

  if (error) {
    console.error("[ChatTools] searchProducts error:", error)
    return []
  }

  if (data && data.length > 0) {
    return data.map((p: any) => mapProduct(p, saleEnabled))
  }

  // No exact match — try individual keywords (e.g. "cerave moisturizer" → search "moisturizer")
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  for (const word of words) {
    const { data: wordData } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
      .or(`name.ilike.%${word}%,description.ilike.%${word}%,tags.cs.{${word}}`)
      .order("name")
      .limit(limit)
    if (wordData && wordData.length > 0) {
      return wordData.map((p: any) => mapProduct(p, saleEnabled))
    }
  }

  // Also try matching against category names
  const { data: catMatch } = await supabase
    .from("categories")
    .select("id")
    .eq("is_active", true)
    .ilike("name", `%${term}%`)
    .limit(1)

  if (catMatch && catMatch.length > 0) {
    const { data: catProducts } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
      .eq("category_id", catMatch[0].id)
      .order("name")
      .limit(limit)
    if (catProducts && catProducts.length > 0) {
      return catProducts.map((p: any) => mapProduct(p, saleEnabled))
    }
  }

  return []
}

// ─── 2. Get Product for Cart ────────────────────────────────────────────────

export async function getProductForCart(supabase: any, slugOrId: string): Promise<ChatProduct | null> {
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

export async function trackOrder(supabase: any, orderNumber: string, email: string): Promise<ChatOrder | null> {
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
    items: (row.order_items || []).map((i: any) => ({
      name: i.name_snapshot || "Item",
      quantity: i.quantity,
      price: Number(i.unit_price) || 0,
    })),
  }
}

// ─── 4. Get Customer Orders ───────────────────────────────────────────────────

export async function getCustomerOrders(supabase: any, userId: string, limit = 5): Promise<ChatOrder[]> {
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

  return data.map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    payment_status: paidFromPayments(o.payments) ? "paid" : "pending",
    total: Number(o.grand_total) || 0,
    created_at: o.created_at,
    tracking_number: undefined,
    items: (o.order_items || []).map((i: any) => ({
      name: i.name_snapshot || "Item",
      quantity: i.quantity,
      price: Number(i.unit_price) || 0,
    })),
  }))
}

// ─── 5. Check Coupon ──────────────────────────────────────────────────────────

export async function checkCoupon(supabase: any, code: string, cartTotal?: number): Promise<ChatCoupon> {
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
  supabase: any,
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
  supabase: any,
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

export async function getRecommendations(supabase: any, context?: string): Promise<ChatProduct[]> {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active")
  if (context?.trim()) {
    q = q.or(`name.ilike.%${context.trim()}%,description.ilike.%${context.trim()}%`)
  }
  const { data, error } = await q.order("rating_avg", { ascending: false }).order("review_count", { ascending: false }).limit(8)

  if (error || !data) return []
  const saleEnabled = await fetchSaleEnabled(supabase)
  const mapped = data.map((p: any) => mapProduct(p, saleEnabled)).filter((p: ChatProduct) => p.inStock)
  return mapped.slice(0, 4)
}

// ─── 9. Get Store Info ───────────────────────────────────────────────────────

const STORE_INFO: Record<string, string> = {
  shipping: `We deliver across Ghana. Fees and timing are shown at checkout. See ${CONTACT_EMAIL} or our Shipping policy page for details.`,
  returns: `We accept returns in line with our Returns policy. Visit /policies/returns on the site or ask us to open a support ticket.`,
  payment: `We accept secure checkout via Paystack (cards & MoMo) and Mobile Money via Moolre where enabled (GHS).`,
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

export async function getCustomerProfile(supabase: any, userId: string): Promise<ChatCustomerProfile | null> {
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

const DELIVERY_COSTS: Record<string, number> = {
  standard: 20,
  express: 40,
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
  supabaseFallback: any,
  params: {
    items: ChatOrderItem[]
    shipping: ChatShippingInfo
    deliveryMethod: string
    paymentMethod: string
    userId?: string | null
  },
): Promise<ChatOrderResult> {
  let admin: any
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
  if (!["paystack", "moolre", "cod"].includes(paymentMethod)) {
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

    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))

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
      product: any
      variant: any
      qty: number
      unit: number
    }[] = []

    for (const item of items) {
      const p = productMap.get(item.productId)!
      const vars = p.variants || []
      const sorted = [...vars].sort((a: any, b: any) => Number(a.price) - Number(b.price))
      const v = sorted[0]
      if (!v) return { success: false, message: `Product "${p.name}" has no purchasable variant.` }
      // Honor sale_price / compare_at_price the same way the storefront does,
      // so the chat customer is charged what they saw — not the original.
      const pricing = effectivePriceForVariant(v, p, saleEnabled)
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
        status: paymentMethod === "paystack" ? "pending" : "pending",
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
        message: `Order ${orderNumber} placed! Total GH₵${total.toFixed(2)} (incl. GH₵${shippingCost.toFixed(2)} delivery). Cash on delivery — our team will confirm.`,
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

    const secretKey = process.env.PAYSTACK_SECRET_KEY

    if (!secretKey) {
      return {
        success: true,
        orderNumber,
        total,
        message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but Paystack is not configured. Complete payment from your account or contact ${CONTACT_EMAIL}.`,
      }
    }

    const amountInPesewas = Math.round(total * 100)
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: sanitizedShipping.email,
        amount: amountInPesewas,
        currency: "GHS",
        reference: orderNumber,
        callback_url: `${baseUrl}/checkout/callback?reference=${encodeURIComponent(orderNumber)}`,
        metadata: {
          order_id: order.id,
          order_number: orderNumber,
        },
      }),
    })

    const paystackData = await paystackRes.json()
    if (!paystackData.status || !paystackData.data?.authorization_url) {
      console.error("[ChatTools] Paystack init failed:", paystackData)
      return {
        success: true,
        orderNumber,
        total,
        message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}). Open Checkout from the site to pay securely.`,
      }
    }

    await admin.from("payments").insert({
      order_id: order.id,
      provider: "paystack",
      provider_ref: paystackData.data.reference,
      amount: total,
      currency: "GHS",
      status: "pending",
    })

    return {
      success: true,
      orderNumber,
      total,
      paymentUrl: paystackData.data.authorization_url,
      message: `Order ${orderNumber} is ready. Total GH₵${total.toFixed(2)} (incl. GH₵${shippingCost.toFixed(2)} delivery). Use the secure Paystack link below to pay.`,
    }
  } catch (err: any) {
    console.error("[ChatTools] createChatOrder:", err)
    return { success: false, message: "Something went wrong. Please use the checkout page on the website." }
  }
}
