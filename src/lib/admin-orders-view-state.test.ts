import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_ORDERS_VIEW, parseOrdersViewState } from "./admin-orders-view-state"

test("restores the saved filters and last opened order", () => {
  const saved = parseOrdersViewState(
    JSON.stringify({ tab: "abandoned", statusFilter: "processing", lastOpenedOrderId: "o-50", scrollY: 4200 }),
  )
  assert.equal(saved.tab, "abandoned")
  assert.equal(saved.statusFilter, "processing")
  assert.equal(saved.lastOpenedOrderId, "o-50")
  assert.equal(saved.scrollY, 4200)
  assert.equal(saved.searchQuery, "")
})

test("falls back to defaults for missing or corrupted storage", () => {
  assert.deepEqual(parseOrdersViewState(null), DEFAULT_ORDERS_VIEW)
  assert.deepEqual(parseOrdersViewState("{not json"), DEFAULT_ORDERS_VIEW)
  assert.equal(parseOrdersViewState(JSON.stringify({ tab: "weird", scrollY: "x" })).tab, "confirmed")
})
