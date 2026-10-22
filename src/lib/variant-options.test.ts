import { test } from "node:test"
import assert from "node:assert/strict"
import { buildOptionValues, findOption, sameOptionValue, sortSizeOptions } from "./variant-options"

test("reads colors stored with `name` (the shape every live row uses)", () => {
  const opts = [
    { name: "Size", value: "10ml" },
    { name: "Color", value: "Red", hex: "#EF4444" },
  ]
  assert.deepEqual(findOption(opts, "color"), { name: "Color", value: "Red", hex: "#EF4444" })
  assert.deepEqual(findOption(opts, "size"), { name: "Size", value: "10ml" })
})

test("reads legacy `attribute_name` rows and British spelling", () => {
  assert.equal(findOption([{ attribute_name: "Colour", value: "Nude" }], "color")?.value, "Nude")
  assert.equal(findOption([{ attribute_name: "Size", value: "M" }], "size")?.value, "M")
})

test("ignores junk: non-arrays, empty values, invalid hex", () => {
  assert.equal(findOption(null, "color"), null)
  assert.equal(findOption("oops", "color"), null)
  assert.equal(findOption([{ name: "Color", value: "" }], "color"), null)
  assert.equal(findOption([{ name: "Color", value: "Red", hex: "red" }], "color")?.hex, undefined)
})

test("buildOptionValues writes Size then Color and keeps a valid hex", () => {
  assert.deepEqual(buildOptionValues({ size: " M ", color: " Blue ", colorHex: "#3b82f6" }), [
    { name: "Size", value: "M" },
    { name: "Color", value: "Blue", hex: "#3B82F6" },
  ])
  assert.deepEqual(buildOptionValues({ size: "", color: "", colorHex: "#000000" }), [])
})

test("round-trips: what the admin saves is what the editor reads back", () => {
  const saved = buildOptionValues({ size: "L", color: "Maroon", colorHex: "#800000" })
  assert.equal(findOption(saved, "color")?.value, "Maroon")
  assert.equal(findOption(saved, "color")?.hex, "#800000")
  assert.equal(findOption(saved, "size")?.value, "L")
})

test("sizes sort in shop order, numbers ascending", () => {
  assert.deepEqual(sortSizeOptions(["XL", "S", "M", "L", "XS"]), ["XS", "S", "M", "L", "XL"])
  assert.deepEqual(sortSizeOptions(["100ml", "30ml", "50ml"]), ["30ml", "50ml", "100ml"])
})

test("option values compare case-insensitively", () => {
  assert.equal(sameOptionValue("nude", " Nude "), true)
  assert.equal(sameOptionValue("Red", "Rose"), false)
})
