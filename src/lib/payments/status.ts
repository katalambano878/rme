/**
 * Internal payment status model + gateway adapters.
 * UI and fulfillment should use InternalPaymentStatus only.
 */

export type InternalPaymentStatus =
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired"
  | "reversed"
  | "refunded"
  | "partially_refunded"

/** Maps to `public.payment_status` enum in DB */
export type DbPaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded"

export function toDbPaymentStatus(status: InternalPaymentStatus): DbPaymentStatus {
  switch (status) {
    case "successful":
      return "paid"
    case "processing":
      return "authorized"
    case "refunded":
    case "partially_refunded":
    case "reversed":
      return "refunded"
    case "failed":
    case "cancelled":
    case "expired":
      return "failed"
    default:
      return "pending"
  }
}

export function normalizePaystackStatus(status: string | undefined | null): InternalPaymentStatus {
  const s = String(status || "").toLowerCase()
  if (s === "success" || s === "successful") return "successful"
  if (s === "failed" || s === "reversed") return s === "reversed" ? "reversed" : "failed"
  if (s === "abandoned") return "cancelled"
  if (s === "ongoing" || s === "pending" || s === "processing") return "processing"
  return "pending"
}

export function normalizeMoolreStatus(input: {
  apiStatus?: unknown
  txStatus?: unknown
  statusStr?: string
  message?: string
}): InternalPaymentStatus {
  const messageStr = String(input.message || "").toLowerCase()
  if (messageStr.includes("fail") || messageStr.includes("error") || messageStr.includes("cancel")) {
    return "failed"
  }

  const statusStr = String(input.statusStr || "").toLowerCase()
  if (["success", "successful", "completed", "paid"].includes(statusStr)) {
    return "successful"
  }

  const apiOk = input.apiStatus === 1 || input.apiStatus === "1"
  const txOk = input.txStatus === 1 || input.txStatus === "1"
  if (apiOk || txOk) return "successful"

  return "pending"
}

export function isPaidInternal(status: InternalPaymentStatus): boolean {
  return status === "successful"
}

export function isPaidDb(status: string | undefined | null): boolean {
  const s = String(status || "").toLowerCase()
  return s === "paid" || s === "completed" || s === "successful"
}
