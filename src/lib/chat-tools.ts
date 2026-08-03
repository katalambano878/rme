import { query as dbQuery, queryOne, withTransaction } from "@/lib/db"
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
  ticket_number: number | string
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

const PRODUCT_SELECT_SQL = `
  p.id, p.name, p.slug, p.status, p.description, p.price, p.sale_price, p.compare_at_price, p.quantity,
  COALESCE(
    (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at)
     FROM variants v WHERE v.product_id = p.id),
    '[]'::jsonb
  ) AS variants,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'sort_order', pi.sort_order) ORDER BY pi.sort_order)
     FROM product_images pi WHERE pi.product_id = p.id),
    '[]'::jsonb
  ) AS product_images
`

async function fetchSaleEnabled(): Promise<boolean> {
  try {
    const row = await queryOne<{ feature_flags: unknown }>(
      `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
    )
    const flags = (row?.feature_flags as Record<string, unknown> | null) ?? {}
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

async function loadProductsWhere(
  whereSql: string,
  params: unknown[],
  limit: number,
): Promise<any[]> {
  const result = await dbQuery(
    `SELECT ${PRODUCT_SELECT_SQL}
     FROM products p
     WHERE p.status = 'active' AND ${whereSql}
     ORDER BY p.name
     LIMIT $${params.length + 1}`,
    [...params, limit],
  )
  return result.rows
}

export async function searchProducts(searchTerm: string, limit = 4): Promise<ChatProduct[]> {
  const term = (searchTerm || "").trim()
  if (!term) return []

  const saleEnabled = await fetchSaleEnabled()
  const pattern = `%${term}%`

  let rows = await loadProductsWhere(
    `(p.name ILIKE $1 OR p.description ILIKE $1)`,
    [pattern],
    limit,
  )

  if (rows.length === 0) {
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    for (const word of words) {
      const wordPattern = `%${word}%`
      rows = await loadProductsWhere(
        `(p.name ILIKE $1 OR p.description ILIKE $1 OR $2 = ANY(p.tags))`,
        [wordPattern, word],
        limit,
      )
      if (rows.length > 0) break
    }
  }

  if (rows.length === 0) {
    const cat = await queryOne<{ id: string }>(
      `SELECT id FROM categories WHERE is_active = true AND name ILIKE $1 LIMIT 1`,
      [pattern],
    )
    if (cat?.id) {
      rows = await loadProductsWhere(`p.category_id = $1::uuid`, [cat.id], limit)
    }
  }

  return rows.map((p) => mapProduct(p, saleEnabled))
}

export async function getProductForCart(slugOrId: string): Promise<ChatProduct | null> {
  if (!slugOrId?.trim()) return null
  const trimmed = slugOrId.trim()
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)

  const row = await queryOne(
    `SELECT ${PRODUCT_SELECT_SQL}
     FROM products p
     WHERE p.status = 'active'
       AND (${isId ? "p.id = $1::uuid" : "p.slug = $1"})
     LIMIT 1`,
    [trimmed],
  )
  if (!row) return null
  const saleEnabled = await fetchSaleEnabled()
  return mapProduct(row, saleEnabled)
}

export async function trackOrder(orderNumber: string, email: string): Promise<ChatOrder | null> {
  if (!orderNumber?.trim() || !email?.trim()) return null
  const num = orderNumber.trim()
  const emailLower = email.trim().toLowerCase()

  let row = await queryOne<any>(
    `SELECT o.id, o.order_number, o.status, o.grand_total, o.created_at, o.guest_email, o.user_id,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('status', p.status))
         FROM payments p WHERE p.order_id = o.id),
        '[]'::jsonb
      ) AS payments,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'name_snapshot', oi.name_snapshot, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total
         ))
         FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o
     WHERE o.order_number = $1
     LIMIT 1`,
    [num],
  )

  if (!row && /^[0-9a-f-]{36}$/i.test(num)) {
    row = await queryOne(
      `SELECT o.id, o.order_number, o.status, o.grand_total, o.created_at, o.guest_email, o.user_id,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('status', p.status))
           FROM payments p WHERE p.order_id = o.id),
          '[]'::jsonb
        ) AS payments,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
             'name_snapshot', oi.name_snapshot, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total
           ))
           FROM order_items oi WHERE oi.order_id = o.id),
          '[]'::jsonb
        ) AS order_items
       FROM orders o
       WHERE o.id::text = $1
       LIMIT 1`,
      [num],
    )
  }

  if (!row) return null

  const guest = (row.guest_email || "").toLowerCase()
  let emailMatches = guest && guest === emailLower

  if (!emailMatches && row.user_id) {
    const ownerProfile = await queryOne<{ email: string | null }>(
      `SELECT email FROM profiles WHERE id = $1::uuid LIMIT 1`,
      [row.user_id],
    )
    const ownerEmail = (ownerProfile?.email || "").toLowerCase()
    emailMatches = !!ownerEmail && ownerEmail === emailLower
  }

  if (!emailMatches) return null

  const payments = Array.isArray(row.payments) ? row.payments : []
  const orderItems = Array.isArray(row.order_items) ? row.order_items : []

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    payment_status: paidFromPayments(payments) ? "paid" : "pending",
    total: Number(row.grand_total) || 0,
    created_at: row.created_at,
    tracking_number: undefined,
    items: orderItems.map((i: any) => ({
      name: i.name_snapshot || "Item",
      quantity: i.quantity,
      price: Number(i.unit_price) || 0,
    })),
  }
}

export async function getCustomerOrders(userId: string, limit = 5): Promise<ChatOrder[]> {
  if (!userId) return []

  const result = await dbQuery(
    `SELECT o.id, o.order_number, o.status, o.grand_total, o.created_at,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('status', p.status))
         FROM payments p WHERE p.order_id = o.id),
        '[]'::jsonb
      ) AS payments,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'name_snapshot', oi.name_snapshot, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total
         ))
         FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o
     WHERE o.user_id = $1::uuid
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [userId, limit],
  )

  return result.rows.map((o: any) => ({
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

export async function checkCoupon(code: string, cartTotal?: number): Promise<ChatCoupon> {
  const trimmed = (code || "").trim().toUpperCase()
  if (!trimmed) return { valid: false, code: trimmed, reason: "No code provided." }

  const data = await queryOne<any>(
    `SELECT * FROM discounts WHERE UPPER(code) = $1 LIMIT 1`,
    [trimmed],
  )
  if (!data) {
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
    expires: data.ends_at || undefined,
  }
}

export async function createSupportTicket(params: {
  userId?: string
  email: string
  subject: string
  description: string
  category?: string
}): Promise<ChatTicket | null> {
  const { userId, email, subject, description, category } = params
  if (!email || !subject || !description) return null

  try {
    const ticketNum = `TKT-${Date.now()}`
    const ticket = await queryOne<any>(
      `INSERT INTO support_tickets (
         ticket_number, subject, description, customer_id, customer_email,
         status, priority, category, channel
       ) VALUES ($1, $2, $3, $4::uuid, $5, 'open', 'medium', $6, 'chat')
       RETURNING id, ticket_number, status, subject`,
      [ticketNum, subject, description, userId || null, email, category || "other"],
    )

    if (!ticket) return null

    try {
      await dbQuery(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_name, content)
         VALUES ($1::uuid, 'customer', $2, $3)`,
        [ticket.id, email, description],
      )
    } catch {
      /* optional table */
    }

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

export async function initiateReturn(params: {
  userId: string
  orderId: string
  reason: string
  description: string
}): Promise<ChatReturn | null> {
  const { userId, orderId, reason, description } = params
  if (!userId || !orderId) return null

  try {
    const order = await queryOne<any>(
      `SELECT id, order_number, status, created_at, user_id FROM orders WHERE id = $1::uuid LIMIT 1`,
      [orderId],
    )
    if (!order || order.user_id !== userId || order.status !== "delivered") return null

    const deliveredDate = new Date(order.created_at)
    const daysSince = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 30) return null

    const ret = await queryOne<any>(
      `INSERT INTO return_requests (order_id, user_id, reason, description, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'pending')
       RETURNING id, status`,
      [orderId, userId, reason, description],
    )
    if (!ret) return null

    return { id: ret.id, status: ret.status, order_number: order.order_number, reason }
  } catch (e) {
    console.error("[ChatTools] initiateReturn:", e)
    return null
  }
}

export async function getRecommendations(context?: string): Promise<ChatProduct[]> {
  const saleEnabled = await fetchSaleEnabled()
  const ctx = context?.trim()

  const result = ctx
    ? await dbQuery(
        `SELECT ${PRODUCT_SELECT_SQL}
         FROM products p
         WHERE p.status = 'active'
           AND (p.name ILIKE $1 OR p.description ILIKE $1)
         ORDER BY p.rating_avg DESC NULLS LAST, p.review_count DESC NULLS LAST
         LIMIT 8`,
        [`%${ctx}%`],
      )
    : await dbQuery(
        `SELECT ${PRODUCT_SELECT_SQL}
         FROM products p
         WHERE p.status = 'active'
         ORDER BY p.rating_avg DESC NULLS LAST, p.review_count DESC NULLS LAST
         LIMIT 8`,
      )

  const mapped = result.rows.map((p: any) => mapProduct(p, saleEnabled)).filter((p: ChatProduct) => p.inStock)
  return mapped.slice(0, 4)
}

const STORE_INFO: Record<string, string> = {
  shipping: `We deliver across Ghana. Fees and timing are shown at checkout. See ${CONTACT_EMAIL} or our Shipping policy page for details.`,
  returns: `We accept returns in line with our Returns policy. Visit /policies/returns on the site or ask us to open a support ticket.`,
  payment: `We accept secure checkout via Paystack (cards & MoMo) and Mobile Money via Moolre where enabled (GHS).`,
  contact: `Reach ${BRAND_NAME}:\n- Email: ${CONTACT_EMAIL}\n- Phone: ${PHONE_DISPLAY_PRIMARY} (${PHONE_INTERNATIONAL_PRIMARY})\n- WhatsApp: ${WHATSAPP_URL}`,
  about: `${BRAND_NAME} — ${BRAND_TAGLINE}. We are a general online store with a curated catalog and nationwide delivery in Ghana.`,
  delivery_times: `Delivery estimates depend on your location and are confirmed at checkout.`,
  hours: `Shop online anytime. For fastest help, use this chat or WhatsApp.`,
}

export function getStoreInfo(topic: string): string {
  const key = (topic || "").toLowerCase().replace(/[^a-z_]/g, "")
  const match = Object.keys(STORE_INFO).find((k) => key.includes(k))
  if (match) return STORE_INFO[match]
  return Object.values(STORE_INFO).join("\n\n")
}

export async function getCustomerProfile(userId: string): Promise<ChatCustomerProfile | null> {
  if (!userId) return null

  const profile = await queryOne<{ full_name: string | null; email: string | null }>(
    `SELECT full_name, email FROM profiles WHERE id = $1::uuid LIMIT 1`,
    [userId],
  )
  if (!profile) return null

  const ordersResult = await dbQuery<{ grand_total: string | number; created_at: string; paid: boolean }>(
    `SELECT o.grand_total, o.created_at,
      EXISTS(SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'paid') AS paid
     FROM orders o
     WHERE o.user_id = $1::uuid`,
    [userId],
  )

  let totalSpent = 0
  let orderCount = 0
  let lastAt: string | null = null
  for (const o of ordersResult.rows) {
    if (o.paid) {
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

export async function createChatOrder(params: {
  items: ChatOrderItem[]
  shipping: ChatShippingInfo
  deliveryMethod: string
  paymentMethod: string
  userId?: string | null
}): Promise<ChatOrderResult> {
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
    const productsResult = await dbQuery(
      `SELECT ${PRODUCT_SELECT_SQL}
       FROM products p
       WHERE p.id = ANY($1::uuid[]) AND p.status = 'active'`,
      [productIds],
    )
    const products = productsResult.rows
    if (!products.length) {
      return { success: false, message: "Could not find the requested products. They may no longer be available." }
    }

    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))
    const saleEnabled = await fetchSaleEnabled()

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
    const lineDetails: { product: any; variant: any; qty: number; unit: number }[] = []

    for (const item of items) {
      const p = productMap.get(item.productId)!
      const vars = p.variants || []
      const sorted = [...vars].sort((a: any, b: any) => Number(a.price) - Number(b.price))
      const v = sorted[0]
      if (!v) return { success: false, message: `Product "${p.name}" has no purchasable variant.` }
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

    const order = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO orders (
           order_number, user_id, guest_email, guest_phone, status,
           subtotal, shipping_total, discount_total, tax_total, grand_total, currency,
           shipping_address, billing_address, notes
         ) VALUES (
           $1, $2::uuid, $3, $4, 'pending',
           $5, $6, 0, 0, $7, 'GHS',
           $8::jsonb, $9::jsonb, $10
         ) RETURNING id`,
        [
          orderNumber,
          userId || null,
          sanitizedShipping.email,
          sanitizedShipping.phone,
          subtotal,
          shippingCost,
          total,
          JSON.stringify(shippingAddress),
          JSON.stringify(shippingAddress),
          `Chat checkout — delivery: ${deliveryMethod}, pay: ${paymentMethod === "moolre" ? "moolre (MoMo)" : paymentMethod}`,
        ],
      )
      const orderId = inserted.rows[0]?.id
      if (!orderId) throw new Error("Order insert failed")

      for (const row of lineDetails) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, variant_id, name_snapshot, sku_snapshot,
             unit_price, quantity, line_total
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)`,
          [
            orderId,
            row.product.id,
            row.variant.id,
            row.product.name,
            row.variant.sku || "",
            row.unit,
            row.qty,
            row.unit * row.qty,
          ],
        )
      }

      return { id: orderId }
    })

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
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but Moolre is not configured.`,
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
        metadata: { customer_email: sanitizedShipping.email, original_order_number: orderNumber },
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
          await dbQuery(
            `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, status)
             VALUES ($1::uuid, 'moolre', $2, $3, 'GHS', 'pending')`,
            [order.id, result.data.reference || uniqueRef, total],
          )
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
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but we could not open Moolre.`,
        }
      } catch (payErr: unknown) {
        console.error("[ChatTools] Moolre payment error:", payErr)
        return {
          success: true,
          orderNumber,
          total,
          message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but payment link failed.`,
        }
      }
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return {
        success: true,
        orderNumber,
        total,
        message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but Paystack is not configured.`,
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
        metadata: { order_id: order.id, order_number: orderNumber },
      }),
    })

    const paystackData = await paystackRes.json()
    if (!paystackData.status || !paystackData.data?.authorization_url) {
      return {
        success: true,
        orderNumber,
        total,
        message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}). Open Checkout from the site to pay securely.`,
      }
    }

    await dbQuery(
      `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, status)
       VALUES ($1::uuid, 'paystack', $2, $3, 'GHS', 'pending')`,
      [order.id, paystackData.data.reference, total],
    )

    return {
      success: true,
      orderNumber,
      total,
      paymentUrl: paystackData.data.authorization_url,
      message: `Order ${orderNumber} is ready. Total GH₵${total.toFixed(2)} (incl. GH₵${shippingCost.toFixed(2)} delivery). Use the secure Paystack link below to pay.`,
    }
  } catch (err: unknown) {
    console.error("[ChatTools] createChatOrder:", err)
    return { success: false, message: "Something went wrong. Please use the checkout page on the website." }
  }
}
