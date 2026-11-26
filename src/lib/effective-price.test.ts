import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_STORE_PRICING,
  displayPricingFromEffective,
  effectivePriceForProduct,
  effectivePriceForVariant,
  liveLinePrice,
  parseStorePricing,
  parseBaseStorePricing,
  parseCampaign,
  campaignState,
  campaignToFlags,
  storePricingToFlags,
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

  it("charges the variant price, not a compare-at display price", () => {
    // Snapshot of a variant priced 60 with compare-at 65.45 and a catalog sale of 55.
    const product = {
      price: 65.45,
      salePrice: 60,
      catalogSalePrice: 55,
      regularPrice: 60,
      variantSalePrice: null,
    }
    assert.equal(liveLinePrice(product, OFF), 60)
    assert.equal(liveLinePrice(product, SALE), 55)
    assert.equal(liveLinePrice({ ...product, variantSalePrice: 50 }, SALE), 50)
  })
})

describe("resolveCatalogSalePrice", () => {
  it("prefers the column, then legacy metadata", () => {
    assert.equal(resolveCatalogSalePrice(12, { sales_price: 9 }), 12)
    assert.equal(resolveCatalogSalePrice(null, { sales_price: 9 }), 9)
    assert.equal(resolveCatalogSalePrice(null, {}), null)
  })
})

describe("scheduled campaign (Black Friday)", () => {
  const flags = {
    sale_promotion_enabled: false,
    store_pricing: { sales_active: false, discount_percent: 0, strict_discount: false },
    campaign: {
      enabled: true,
      name: "Black Friday",
      starts_at: "2026-11-27T00:00:00.000Z",
      ends_at: "2026-11-30T00:00:00.000Z",
      discount_percent: 20,
      message: "",
    },
  }
  const before = Date.parse("2026-11-26T23:59:00Z")
  const during = Date.parse("2026-11-28T12:00:00Z")
  const after = Date.parse("2026-11-30T00:00:01Z")

  it("is upcoming, live and ended at the right times", () => {
    const c = parseCampaign(flags)
    assert.equal(campaignState(c, before), "upcoming")
    assert.equal(campaignState(c, during), "live")
    assert.equal(campaignState(c, after), "ended")
    assert.equal(campaignState({ ...c!, enabled: false }, during), "off")
  })

  it("switches the sale on only while live, and leaves her everyday settings alone", () => {
    assert.equal(parseStorePricing(flags, before).salesActive, false)
    assert.deepEqual(parseStorePricing(flags, during), {
      salesActive: true,
      discountPercent: 20,
      strictDiscount: false,
      bestPrice: true,
    })
    assert.equal(parseStorePricing(flags, after).salesActive, false)
    assert.equal(parseBaseStorePricing(flags).salesActive, false)
  })

  it("gives each item the cheaper of its own sale price and the campaign percent", () => {
    const live = parseStorePricing(flags, during)
    // own sale price 70 beats 20% off (80)
    assert.equal(effectivePriceForVariant({ price: 100, sale_price: 70 }, {}, live).effective, 70)
    // 20% off (80) beats a weak sale price of 95
    assert.equal(effectivePriceForVariant({ price: 100, sale_price: 95 }, {}, live).effective, 80)
    // no sale price: 20% off
    const plain = effectivePriceForVariant({ price: 100 }, {}, live)
    assert.equal(plain.effective, 80)
    assert.equal(plain.original, 100)
    assert.equal(plain.onSale, true)
  })

  it("with 0% it is promotion only and prices stay exactly as they were", () => {
    const zero = { ...flags, campaign: { ...flags.campaign, discount_percent: 0 } }
    const live = parseStorePricing(zero, during)
    assert.deepEqual(live, parseBaseStorePricing(zero))
    assert.equal(live.salesActive, false)
    assert.equal(effectivePriceForVariant({ price: 100 }, {}, live).effective, 100)
    // her own sale price does not switch on just because Black Friday is live
    assert.equal(effectivePriceForVariant({ price: 100, sale_price: 60 }, {}, live).effective, 100)
  })

  it("keeps her campaign when everyday settings are saved", () => {
    const saved = storePricingToFlags(
      { salesActive: true, discountPercent: 0, strictDiscount: false },
      flags,
    ) as Record<string, unknown>
    assert.ok(saved.campaign)
    const removed = campaignToFlags(null, saved) as Record<string, unknown>
    assert.equal(removed.campaign, undefined)
  })
})
