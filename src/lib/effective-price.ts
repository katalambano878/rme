/**
 * Centralized "what should the customer actually pay?" logic.
 *
 * IMPORTANT: this is the single source of truth for effective pricing on both
 * the client (cart/checkout display) and the server (when re-validating order
 * totals before sending them to Moolre). If these two ever disagree,
 * the customer sees one price and gets charged another — which is exactly the
 * bug this module exists to prevent.
 *
 * Pricing priority (matches MK Gadgets store-wide sale / bulk discount):
 *
 *   1. If store-wide sale is ON and not in strict bulk mode:
 *        a. Variant-level `sale_price` (if > 0 and < regular)
 *        b. Product-level `sale_price` (if > 0 and < regular)
 *   2. If store-wide sale is ON and a bulk percent is set:
 *        apply that percent to the regular price (the only rule in strict mode)
 *   3. Always (regardless of toggle): if compare_at_price > regular price,
 *      regular is the sale amount and compare-at is the "was" price.
 *   4. Otherwise: regular price.
 *
 * Callers may still pass a boolean (the old sale toggle). That is treated as
 * sale-price mode with no bulk percent.
 *
 * The function returns BOTH the original price and the effective (charge)
 * price so the caller can show "was 10, now 8" UI or just charge 8.
 */

export interface VariantLike {
  price: number | string | null | undefined
  sale_price?: number | string | null
  compare_at_price?: number | string | null
}

export interface ProductPricingLike {
  price?: number | string | null
  sale_price?: number | string | null
  compare_at_price?: number | string | null
}

export type StorePricing = {
  salesActive: boolean
  discountPercent: number
  strictDiscount: boolean
  /**
   * Campaign mode (e.g. Black Friday): each item gets the cheaper of its own
   * sale price and the store-wide percentage, so no one gets the smaller deal.
   */
  bestPrice?: boolean
}

export const DEFAULT_STORE_PRICING: StorePricing = {
  salesActive: false,
  discountPercent: 0,
  strictDiscount: false,
}

/** Admin / checkout / storefront all accept the old boolean or the full rule. */
export type PricingInput = StorePricing | boolean | null | undefined

export function asStorePricing(input: PricingInput): StorePricing {
  if (input == null) return DEFAULT_STORE_PRICING
  if (typeof input === "boolean") {
    return { salesActive: input, discountPercent: 0, strictDiscount: false }
  }
  return {
    salesActive: Boolean(input.salesActive),
    discountPercent: Number(input.discountPercent) || 0,
    strictDiscount: Boolean(input.strictDiscount),
    bestPrice: Boolean(input.bestPrice),
  }
}

// ─── Scheduled campaigns (Black Friday etc.) ─────────────────────────────────

/** A timed sale stored as feature_flags.campaign. */
export type Campaign = {
  enabled: boolean
  name: string
  /** ISO timestamps. */
  startsAt: string
  endsAt: string
  /** % off items that have no better sale price of their own (0 = only her sale prices). */
  discountPercent: number
  /** Optional custom line for the notice bar. */
  message: string
}

export type CampaignState = "off" | "upcoming" | "live" | "ended"

export function parseCampaign(flags: unknown): Campaign | null {
  if (!flags || typeof flags !== "object") return null
  const raw = (flags as Record<string, unknown>).campaign
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  const startsAt = typeof c.starts_at === "string" ? c.starts_at : ""
  const endsAt = typeof c.ends_at === "string" ? c.ends_at : ""
  if (!startsAt || !endsAt || Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) return null
  const pct = Number(c.discount_percent)
  return {
    enabled: Boolean(c.enabled),
    name: (typeof c.name === "string" && c.name.trim()) || "Black Friday",
    startsAt,
    endsAt,
    discountPercent: Number.isFinite(pct) ? Math.min(90, Math.max(0, Math.round(pct))) : 0,
    message: typeof c.message === "string" ? c.message.trim().slice(0, 160) : "",
  }
}

export function campaignState(c: Campaign | null, now: number = Date.now()): CampaignState {
  if (!c || !c.enabled) return "off"
  const start = Date.parse(c.startsAt)
  const end = Date.parse(c.endsAt)
  if (!(end > start)) return "off"
  if (now < start) return "upcoming"
  if (now >= end) return "ended"
  return "live"
}

export function campaignToFlags(c: Campaign | null, existing?: Record<string, unknown> | null) {
  const next = { ...(existing ?? {}) }
  if (!c) {
    delete next.campaign
    return next
  }
  next.campaign = {
    enabled: c.enabled,
    name: c.name,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    discount_percent: c.discountPercent,
    message: c.message,
  }
  return next
}

/**
 * What customers are charged right now: a live campaign switches the sale on
 * (her own sale prices plus the campaign percentage, cheapest wins); otherwise
 * her everyday sale settings apply. Used by the storefront, bag, checkout,
 * chatbot and till alike, so they always agree.
 */
export function parseStorePricing(flags: unknown, now: number = Date.now()): StorePricing {
  const campaign = parseCampaign(flags)
  if (campaignState(campaign, now) === "live" && campaign) {
    return { salesActive: true, discountPercent: campaign.discountPercent, strictDiscount: false, bestPrice: true }
  }
  return parseBaseStorePricing(flags)
}

/**
 * Her everyday sale settings only, ignoring any campaign. The Sale & discounts
 * screen reads this so saving there never bakes Black Friday in permanently.
 */
export function parseBaseStorePricing(flags: unknown): StorePricing {
  if (!flags || typeof flags !== "object") return DEFAULT_STORE_PRICING
  const obj = flags as Record<string, unknown>
  const nested =
    obj.store_pricing && typeof obj.store_pricing === "object"
      ? (obj.store_pricing as Record<string, unknown>)
      : null
  const salesActive = Boolean(
    nested?.sales_active ?? obj.sale_promotion_enabled ?? obj.sales_active,
  )
  const discountPercent =
    Number(nested?.discount_percent ?? obj.discount_percent) || 0
  const strictDiscount = Boolean(
    nested?.strict_discount ?? obj.strict_discount,
  )
  return { salesActive, discountPercent, strictDiscount }
}

export function storePricingToFlags(pricing: StorePricing, existing?: Record<string, unknown> | null) {
  const next = {
    sales_active: pricing.salesActive,
    discount_percent: pricing.discountPercent,
    strict_discount: pricing.strictDiscount,
  }
  return {
    ...(existing ?? {}),
    sale_promotion_enabled: pricing.salesActive,
    discount_percent: pricing.discountPercent,
    strict_discount: pricing.strictDiscount,
    store_pricing: next,
  }
}

function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent <= 0 || discountPercent > 100) return price
  return Math.round(price * (1 - discountPercent / 100) * 100) / 100
}

function isUsableSale(sale: number, regular: number): boolean {
  return Number.isFinite(sale) && sale > 0 && sale < regular
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Promotional amount the admin typed as Sales (GH₵).
 * Newer saves write `products.sale_price`. Older saves only stored
 * `metadata.sales_price` / `metadata.sale_price`, which the storefront ignored.
 */
export function resolveCatalogSalePrice(
  column: number | string | null | undefined,
  metadata?: Record<string, unknown> | null,
): number | null {
  const fromColumn = num(column)
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata.sales_price ?? metadata.sale_price
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  const fromMeta = num(raw)
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta
  return null
}

export function withResolvedSalePrice<
  T extends {
    sale_price?: number | string | null
    metadata?: Record<string, unknown> | null
  },
>(product: T): T {
  const resolved = resolveCatalogSalePrice(product.sale_price, product.metadata)
  if (resolved == null) return product
  return { ...product, sale_price: resolved }
}

export interface EffectivePrice {
  /** What the customer ACTUALLY pays (the lower of original/sale). */
  effective: number
  /** The "before discount" / original price (for strikethrough UI). */
  original: number
  /** True when effective < original (i.e. a real discount is applied). */
  onSale: boolean
}

/**
 * Compute the effective price for a SPECIFIC variant of a product.
 *
 * Use this on the server when you know exactly which variant the customer is
 * buying (e.g. they picked size M / color Red at checkout).
 */
export function effectivePriceForVariant(
  variant: VariantLike,
  product: ProductPricingLike,
  saleEnabled: PricingInput,
): EffectivePrice {
  const variantPrice = num(variant.price)
  if (!Number.isFinite(variantPrice) || variantPrice <= 0) {
    return { effective: 0, original: 0, onSale: false }
  }

  const { salesActive, discountPercent, strictDiscount, bestPrice } = asStorePricing(saleEnabled)

  if (salesActive && bestPrice) {
    // Campaign: cheapest of her sale prices and the campaign percentage.
    let best = variantPrice
    const variantSale = num(variant.sale_price)
    const productSale = num(product.sale_price)
    if (isUsableSale(variantSale, variantPrice)) best = Math.min(best, variantSale)
    else if (isUsableSale(productSale, variantPrice)) best = Math.min(best, productSale)
    if (discountPercent > 0) best = Math.min(best, applyDiscount(variantPrice, discountPercent))
    if (best < variantPrice) return { effective: best, original: variantPrice, onSale: true }
  }

  if (salesActive && !bestPrice) {
    const strictMode = strictDiscount && discountPercent > 0
    if (!strictMode) {
      const variantSale = num(variant.sale_price)
      if (isUsableSale(variantSale, variantPrice)) {
        return { effective: variantSale, original: variantPrice, onSale: true }
      }
      const productSale = num(product.sale_price)
      if (isUsableSale(productSale, variantPrice)) {
        return { effective: productSale, original: variantPrice, onSale: true }
      }
    }
    if (discountPercent > 0) {
      const discounted = applyDiscount(variantPrice, discountPercent)
      if (discounted < variantPrice) {
        return { effective: discounted, original: variantPrice, onSale: true }
      }
    }
  }

  const compareAt = num(variant.compare_at_price ?? product.compare_at_price)
  if (Number.isFinite(compareAt) && compareAt > variantPrice) {
    return { effective: variantPrice, original: compareAt, onSale: true }
  }

  return { effective: variantPrice, original: variantPrice, onSale: false }
}

/** Storefront UI: strikethrough original + optional sale line item. */
export function displayPricingFromEffective(pricing: EffectivePrice): {
  price: number
  salePrice?: number
} {
  return pricing.onSale
    ? { price: pricing.original, salePrice: pricing.effective }
    : { price: pricing.effective }
}

export function displayPricingForVariant(
  variant: VariantLike,
  catalogSalePrice: number | string | null | undefined,
  saleEnabled: PricingInput,
): { price: number; salePrice?: number } {
  return displayPricingFromEffective(
    effectivePriceForVariant(variant, { sale_price: catalogSalePrice }, saleEnabled),
  )
}

export function displayPricingForProductCard(
  variants: VariantLike[],
  catalogSalePrice: number | string | null | undefined,
  saleEnabled: PricingInput,
): { price: number; salePrice?: number } {
  const pricing = effectivePriceForProduct(
    { sale_price: catalogSalePrice, variants },
    saleEnabled,
  )
  return displayPricingFromEffective(pricing)
}

/**
 * Compute the effective price for a product when no specific variant has been
 * selected yet (e.g. on a product card). Picks the cheapest variant.
 *
 * If the product has no variants, falls back to the product-level price /
 * sale_price columns.
 */
export function effectivePriceForProduct(
  product: ProductPricingLike & { variants?: VariantLike[] | null },
  saleEnabled: PricingInput,
): EffectivePrice {
  const variants = product.variants ?? []
  if (variants.length > 0) {
    // Pick the variant with the lowest *effective* price so the displayed "from"
    // price actually reflects the cheapest the customer can pay.
    let best: EffectivePrice | null = null
    for (const v of variants) {
      const pricing = effectivePriceForVariant(v, product, saleEnabled)
      if (pricing.effective <= 0) continue
      if (!best || pricing.effective < best.effective) best = pricing
    }
    if (best) return best
  }

  // Simple product (no variants) — fall back to the product-level columns
  const productPrice = num(product.price)
  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    return { effective: 0, original: 0, onSale: false }
  }
  return effectivePriceForVariant(
    {
      price: productPrice,
      sale_price: product.sale_price,
      compare_at_price: product.compare_at_price,
    },
    product,
    saleEnabled,
  )
}

/** Recompute a persisted cart/checkout snapshot against the live store rule. */
export function liveLinePrice(
  product: {
    price?: number | string | null
    salePrice?: number | string | null
    catalogSalePrice?: number | string | null
    regularPrice?: number | string | null
    variantSalePrice?: number | string | null
  },
  saleEnabled: PricingInput,
): number {
  // Newer snapshots carry the variant's real price, so this matches the
  // server exactly (compare-at "was" prices never leak in as the charge).
  if (product.regularPrice != null && num(product.regularPrice) > 0) {
    return effectivePriceForVariant(
      { price: product.regularPrice, sale_price: product.variantSalePrice },
      { sale_price: product.catalogSalePrice },
      saleEnabled,
    ).effective
  }
  const regular = num(product.price)
  if (!Number.isFinite(regular) || regular <= 0) return 0
  return effectivePriceForVariant(
    {
      price: regular,
      sale_price: product.catalogSalePrice ?? product.salePrice,
    },
    { sale_price: product.catalogSalePrice ?? product.salePrice },
    saleEnabled,
  ).effective
}
