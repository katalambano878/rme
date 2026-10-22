import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { markdownPrice, readMarkdown } from "./admin-product-markdown"

describe("markdownPrice", () => {
  it("takes a percent off and rounds to pesewas", () => {
    assert.equal(markdownPrice(40, "percent", 25), 30)
    assert.equal(markdownPrice(33, "percent", 10), 29.7)
  })

  it("takes a fixed cedis amount off", () => {
    assert.equal(markdownPrice(40, "fixed", 12.5), 27.5)
  })
})

describe("readMarkdown", () => {
  it("reads a stored markdown and rejects junk", () => {
    const ok = readMarkdown({
      discount: { original_price: 40, original_compare_at: null, original_sale_price: 28, type: "percent", value: 10, applied_at: "x" },
    })
    assert.equal(ok?.original_price, 40)
    assert.equal(readMarkdown({}), null)
    assert.equal(readMarkdown({ discount: { original_price: 0, type: "percent", value: 10 } }), null)
  })
})
