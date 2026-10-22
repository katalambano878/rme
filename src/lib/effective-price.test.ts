import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_STORE_PRICING,
  displayPricingFromEffective,
  effectivePriceForProduct,
  effectivePriceForVariant,
  liveLinePrice,
  parseStorePricing,
  resolveCatalogSalePrice,
} from "./effective-price"

const SALE = { salesActive: true, discountPercent: 0, strictDiscount: false }
const BULK_50 = { salesActive: true, discountPercent: 50, strictDiscount: true }
const OFF = DEFAULT_STORE_PRICING

describe("parseStorePricing", () => {
  it("defaults when flags are empty", () => {
    assert.deepEqual(parseStorePricing(null), OFF)
    assert.deepEqual(parseStorePricing({}), OFF)
  })

  it("reads the sale toggle and nested store_pricing", () => {
    assert.deepEqual(parseStorePricing({ sale_promotion_enabled: true }), SALE)
    assert.deepEqual(
      parseStorePricing({
        store_pricing: { sales_active: true, discount_percent: 20, strict_discount: true },
      }),
      { salesActive: true, discountPercent: 20, strictDiscount: true },
    )
  })
})

describe("effectivePriceForVariant — store-wide sale", () => {
  it("uses the variant sale price when sale mode is on", () => {
    const r = effectivePriceForVariant(
      { price: 40, sale_price: 28 },
      { sale_price: 35 },
      SALE,
    )
    assert.deepEqual(r, { effective: 28, original: 40, onSale: true })
  })

  it("falls back to the product sale price", () => {
    const r = effectivePriceForVariant({ price: 40 }, { sale_price: 32 }, SALE)
    assert.deepEqual(r, { effective: 32, original: 40, onSale: true })
  })

  it("keeps the regular price when sale mode is on but no sale amount is set", () => {
    const r = effectivePriceForVariant({ price: 40 }, {}, SALE)
    assert.deepEqual(r, { effective: 40, original: 40, onSale: false })
  })

  it("ignores sale prices when the toggle is off", () => {
    const r = effectivePriceForVariant(
      { price: 40, sale_price: 28 },
      { sale_price: 32 },
      OFF,
    )
    assert.deepEqual(r, { effective: 40, original: 40, onSale: false })
  })

  it("still honours compare-at when no promotion is running", () => {
    const r = effectivePriceForVariant(
      { price: 30, compare_at_price: 50 },
      {},
      OFF,
    )
    assert.deepEqual(r, { effective: 30, original: 50, onSale: true })
  })

  it("accepts the old boolean toggle so existing callers keep working", () => {
    const r = effectivePriceForVariant({ price: 40, sale_price: 28 }, {}, true)
    assert.equal(r.effective, 28)
  })
})

describe("effectivePriceForVariant — bulk percentage", () => {
  it("takes the percentage off the regular price and ignores sale prices", () => {
    const r = effectivePriceForVariant(
      { price: 40, sale_price: 35 },
      { sale_price: 32 },
      BULK_50,
    )
    assert.deepEqual(r, { effective: 20, original: 40, onSale: true })
  })

  it("applies a non-strict fallback percent when a product has no sale price", () => {
    const r = effectivePriceForVariant(
      { price: 40 },
      {},
      { salesActive: true, discountPercent: 25, strictDiscount: false },
    )
    assert.deepEqual(r, { effective: 30, original: 40, onSale: true })
  })
})

describe("effectivePriceForProduct", () => {
  it("picks the cheapest variant after the live rule", () => {
    const r = effectivePriceForProduct(
      {
        price: 50,
        sale_price: 45,
        variants: [
          { price: 50, sale_price: 40 },
          { price: 60, sale_price: 20 },
        ],
      },
      SALE,
    )
    assert.equal(r.effective, 20)
    assert.equal(r.original, 60)
  })

  it("uses the product row when there are no variants", () => {
    const r = effectivePriceForProduct({ price: 40, sale_price: 22 }, SALE)
    assert.deepEqual(r, { effective: 22, original: 40, onSale: true })
  })
})

describe("display + cart line helpers", () => {
  it("maps on-sale pricing to amount + salePrice for the Price component", () => {
    assert.deepEqual(displayPricingFromEffective({ effective: 20, original: 40, onSale: true }), {
      price: 40,
      salePrice: 20,
    })
    assert.deepEqual(displayPricingFromEffective({ effective: 40, original: 40, onSale: false }), {
      price: 40,
    })
  })

  it("recomputes a cart snapshot against the live store rule", () => {
    const product = {
      price: 40,
      salePrice: 28,
      catalogSalePrice: 28,
    }
    assert.equal(liveLinePrice(product, SALE), 28)
    assert.equal(liveLinePrice(product, OFF), 40)
    assert.equal(liveLinePrice(product, BULK_50), 20)
  })
})

describe("resolveCatalogSalePrice", () => {
  it("prefers the column, then legacy metadata", () => {
    assert.equal(resolveCatalogSalePrice(12, { sales_price: 9 }), 12)
    assert.equal(resolveCatalogSalePrice(null, { sales_price: 9 }), 9)
    assert.equal(resolveCatalogSalePrice(null, {}), null)
  })
})
