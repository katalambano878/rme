import { test } from "node:test"
import assert from "node:assert/strict"
import { controlKey, isRememberedInputType, isReturnFromChild, parseAdminPlaces, parseSavedControls } from "./admin-place"

test("coming out of a detail returns to that list", () => {
  assert.equal(isReturnFromChild("/admin/orders/abc", "/admin/orders"), true)
  assert.equal(isReturnFromChild("/admin/products/p1", "/admin/products"), true)
  assert.equal(isReturnFromChild("/admin/customers/c1/", "/admin/customers"), true)
  assert.equal(isReturnFromChild("/admin/orders/abc?x=1", "/admin/orders"), true)
})

test("opening a detail or switching sections does not restore the list", () => {
  assert.equal(isReturnFromChild("/admin/orders", "/admin/orders/abc"), false)
  assert.equal(isReturnFromChild("/admin/orders", "/admin/products"), false)
  assert.equal(isReturnFromChild("/admin/orders", "/admin/orders"), false)
  assert.equal(isReturnFromChild("", "/admin/orders"), false)
})

test("ignores corrupted place memory", () => {
  assert.deepEqual(parseAdminPlaces(null), {})
  assert.deepEqual(parseAdminPlaces("{"), {})
  assert.deepEqual(parseAdminPlaces(JSON.stringify({ "/admin/orders": 1800, "/admin/products": "nope", "/admin/customers": -4 })), {
    "/admin/orders": 1800,
  })
})

test("remembered fields are keyed so the same box is found again", () => {
  assert.equal(
    controlKey({ tag: "input", type: "text", label: "Search products by name, SKU, or category...", index: 0 }),
    "input:text:Search products by name, SKU, or category...#0",
  )
  assert.equal(controlKey({ tag: "select", type: "", label: "Sort orders", index: 1 }), "select::Sort orders#1")
})

test("only search-like fields are remembered, never passwords or files", () => {
  for (const type of ["text", "search", "date", "number"]) assert.equal(isRememberedInputType(type), true)
  for (const type of ["password", "file", "checkbox", "radio", "hidden", "email"]) assert.equal(isRememberedInputType(type), false)
})

test("ignores corrupted filter memory and caps what it keeps", () => {
  assert.deepEqual(parseSavedControls(null), {})
  assert.deepEqual(parseSavedControls("not json"), {})
  const long = "x".repeat(500)
  const parsed = parseSavedControls(
    JSON.stringify({
      "/admin/products/": [{ key: "input:text:Search#0", value: long }, { key: 3, value: "bad" }],
      "/admin/orders": "nope",
    }),
  )
  assert.deepEqual(Object.keys(parsed), ["/admin/products"])
  assert.equal(parsed["/admin/products"].length, 1)
  assert.equal(parsed["/admin/products"][0].value.length, 200)
})
