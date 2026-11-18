import { test } from "node:test"
import assert from "node:assert/strict"
import { isReturnFromChild, parseAdminPlaces } from "./admin-place"

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
