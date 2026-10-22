/**
 * Centralized "what should the customer actually pay?" logic.
 *
 * IMPORTANT: this is the single source of truth for effective pricing on both
 * the client (cart/checkout display) and the server (when re-validating order
 * totals before sending them to Paystack/Moolre). If these two ever disagree,
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
  }
}

/** Read store_pricing from site_settings.feature_flags. */
export function parseStorePricing(flags: unknown): StorePricing {
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

  const { salesActive, discountPercent, strictDiscount } = asStorePricing(saleEnabled)

  if (salesActive) {
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
  },
  saleEnabled: PricingInput,
): number {
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
