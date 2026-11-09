import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { decideVerdict, moolreRefsFor, needsMoolreCheck, type ReconcileOrderRow } from "./order-reconcile"

function order(overrides: Partial<ReconcileOrderRow> = {}): ReconcileOrderRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_number: "ORD-ABC123",
    status: "pending",
    grand_total: 120,
    created_at: "2026-11-01T10:00:00Z",
    notes: null,
    guest_email: "buyer@example.com",
    guest_phone: "0241234567",
    payments: [],
    ...overrides,
  }
}

const paid = (amount: number) => ({ reached: true, tx: { txstatus: 1, amount, transactionid: 9876 } })
const notPaid = { reached: true, tx: { txstatus: 0 } }
const noAnswer = { reached: false, tx: null }

describe("decideVerdict", () => {
  it("flags a full Moolre payment that was never recorded", () => {
    const v = decideVerdict(order(), [notPaid, paid(120)])
    assert.equal(v.verdict, "paid_not_recorded")
    assert.equal(v.paidAmount, 120)
    assert.equal(v.transactionId, "9876")
  })

  it("accepts a small MoMo fee on top of the total", () => {
    assert.equal(decideVerdict(order(), [paid(122)]).verdict, "paid_not_recorded")
  })

  it("holds back payments for a different amount", () => {
    assert.equal(decideVerdict(order(), [paid(60)]).verdict, "amount_mismatch")
    assert.equal(decideVerdict(order(), [paid(500)]).verdict, "amount_mismatch")
  })

  it("calls an order unpaid only when Moolre actually answered", () => {
    assert.equal(decideVerdict(order(), [notPaid]).verdict, "unpaid")
    assert.equal(decideVerdict(order(), [noAnswer, notPaid]).verdict, "unpaid")
    assert.equal(decideVerdict(order(), [noAnswer]).verdict, "unknown")
    assert.equal(decideVerdict(order(), []).verdict, "unknown")
  })
})

describe("moolreRefsFor", () => {
  it("tries stored refs, their retry-free form, then the order number", () => {
    const refs = moolreRefsFor(
      order({
        payments: [
          { status: "pending", provider: "moolre", provider_ref: "ORD-ABC123-R2" },
          { status: "pending", provider: "cash", provider_ref: "ignored" },
        ],
      }),
    )
    assert.deepEqual(refs, ["ORD-ABC123-R2", "ORD-ABC123"])
  })
})

describe("needsMoolreCheck", () => {
  it("skips paid orders and POS sales, checks everything else", () => {
    assert.equal(needsMoolreCheck(order()), true)
    assert.equal(needsMoolreCheck(order({ status: "shipped" })), true)
    assert.equal(needsMoolreCheck(order({ payments: [{ status: "paid", provider: "moolre", provider_ref: "x" }] })), false)
    assert.equal(needsMoolreCheck(order({ notes: "POS sale - cash" })), false)
  })
})
