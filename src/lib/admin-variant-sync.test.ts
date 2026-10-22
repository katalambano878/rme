import { test } from "node:test"
import assert from "node:assert/strict"
import { planVariantSync, type DesiredVariant } from "./admin-variant-sync"

const v = (over: Partial<DesiredVariant>): DesiredVariant => ({
  size: "",
  color: "",
  price: 10,
  compareAtPrice: null,
  salePrice: null,
  stock: 5,
  ...over,
})

test("saving an unchanged product updates rows in place and deletes nothing", () => {
  const plan = planVariantSync(
    ["a", "b"],
    [v({ id: "a", color: "Red", sku: "ST-1-1" }), v({ id: "b", color: "Blue", sku: "ST-1-2" })],
    "ST-1",
  )
  assert.deepEqual(plan.toDelete, [])
  assert.equal(plan.toInsert.length, 0)
  assert.deepEqual(plan.toUpdate.map((u) => [u.id, u.row.sku]), [["a", "ST-1-1"], ["b", "ST-1-2"]])
  assert.deepEqual(plan.toUpdate[0].row.option_values, [{ name: "Color", value: "Red" }])
})

test("adding a color inserts one row with a SKU that doesn't collide", () => {
  const plan = planVariantSync(
    ["a", "b"],
    [
      v({ id: "a", color: "Red", sku: "ST-1-1" }),
      v({ id: "b", color: "Blue", sku: "ST-1-2" }),
      v({ color: "Pink", colorHex: "#EC4899" }),
    ],
    "ST-1",
  )
  assert.deepEqual(plan.toDelete, [])
  assert.equal(plan.toInsert.length, 1)
  assert.equal(plan.toInsert[0].sku, "ST-1-3")
  assert.deepEqual(plan.toInsert[0].option_values, [{ name: "Color", value: "Pink", hex: "#EC4899" }])
})

test("removing a color deletes only that row", () => {
  const plan = planVariantSync(["a", "b"], [v({ id: "a", color: "Red", sku: "ST-1-1" })], "ST-1")
  assert.deepEqual(plan.toDelete, ["b"])
  assert.deepEqual(plan.toUpdate.map((u) => u.id), ["a"])
})

test("ids that no longer exist in the database are inserted, not updated", () => {
  const plan = planVariantSync(["a"], [v({ id: "gone", color: "Red", sku: "ST-1-1" })], "ST-1")
  assert.deepEqual(plan.toDelete, ["a"])
  assert.equal(plan.toUpdate.length, 0)
  assert.equal(plan.toInsert[0].sku, "ST-1-1")
})

test("a new simple product uses the product SKU for its single row", () => {
  const plan = planVariantSync([], [v({})], "ST-9")
  assert.equal(plan.toInsert[0].sku, "ST-9")
  assert.deepEqual(plan.toInsert[0].option_values, [])
})

test("new rows never reuse a SKU still held by a kept row", () => {
  const plan = planVariantSync(
    ["a"],
    [v({ id: "a", size: "S", sku: "ST-1-2" }), v({ size: "M" }), v({ size: "L" })],
    "ST-1",
  )
  const skus = [...plan.toUpdate.map((u) => u.row.sku), ...plan.toInsert.map((r) => r.sku)]
  assert.equal(new Set(skus.map((s) => s.toLowerCase())).size, skus.length)
  assert.deepEqual(plan.toInsert.map((r) => r.sku), ["ST-1-1", "ST-1-3"])
})
