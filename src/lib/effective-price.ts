/**
 * Centralized "what should the customer actually pay?" logic.
 *
 * IMPORTANT: this is the single source of truth for effective pricing on both
 * the client (cart/checkout display) and the server (when re-validating order
 * totals before sending them to Paystack/Moolre). If these two ever disagree,
 * the customer sees one price and gets charged another — which is exactly the
 * bug this module exists to prevent.
 *
 * Pricing priority (matches the storefront card pricing logic):
 *
 *   1. If the global `sale_promotion_enabled` flag is ON:
 *        a. Variant-level `sale_price` (if > 0 and < variant.price)
 *        b. Product-level `sale_price` (if > 0 and < variant.price)
 *   2. Always (regardless of toggle): if variant.compare_at_price > variant.price,
 *      then variant.price is treated as the sale price and compare_at as the
 *      original. This matches retailers' "was X, now Y" convention.
 *   3. Otherwise: variant.price.
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

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
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
  saleEnabled: boolean,
): EffectivePrice {
  const variantPrice = num(variant.price)
  if (!Number.isFinite(variantPrice) || variantPrice <= 0) {
    return { effective: 0, original: 0, onSale: false }
  }

  // 1. Toggle-gated sale: variant-level then product-level
  if (saleEnabled) {
    const variantSale = num(variant.sale_price)
    if (Number.isFinite(variantSale) && variantSale > 0 && variantSale < variantPrice) {
      return { effective: variantSale, original: variantPrice, onSale: true }
    }
    const productSale = num(product.sale_price)
    if (Number.isFinite(productSale) && productSale > 0 && productSale < variantPrice) {
      return { effective: productSale, original: variantPrice, onSale: true }
    }
  }

  // 2. Compare-at sale (always honored): "was X, now Y"
  const compareAt = num(variant.compare_at_price)
  if (Number.isFinite(compareAt) && compareAt > variantPrice) {
    return { effective: variantPrice, original: compareAt, onSale: true }
  }

  // 3. Regular price
  return { effective: variantPrice, original: variantPrice, onSale: false }
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
  saleEnabled: boolean,
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
