/**
 * Official Moolre payment-status API.
 * Docs: POST https://api.moolre.com/open/transact/status
 *
 * The old `/embed/status` URL 404s — verify must not use it.
 */

export type MoolreTx = {
  txstatus?: number | string
  amount?: string | number
  value?: string | number
  transactionid?: string | number
  externalref?: string
  thirdpartyref?: string
  payer?: string
}

type StatusEnvelope = {
  status?: number
  code?: string
  message?: string
  data?: MoolreTx
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-USER": process.env.MOOLRE_API_USER || "",
    "X-API-PUBKEY": process.env.MOOLRE_API_PUBKEY || "",
  }
}

export function isSuccessfulMoolreTx(tx: MoolreTx | null | undefined): boolean {
  if (!tx) return false
  const st = tx.txstatus
  return st === 1 || st === "1"
}

/**
 * Accept exact amount, or a slightly higher amount when the customer was
 * charged a MoMo/network fee on top of the order total.
 */
export function amountMatchesOrder(paid: number, expected: number): boolean {
  if (!Number.isFinite(paid) || !Number.isFinite(expected)) return false
  if (Math.abs(paid - expected) <= 0.05) return true
  const feeAllowance = Math.max(10, expected * 0.05)
  return paid > expected && paid - expected <= feeAllowance + 0.05
}

/** Moolre API origin; overridable so a test double can stand in locally. */
export function moolreApiBase(): string {
  return (process.env.MOOLRE_API_URL || "https://api.moolre.com").replace(/\/+$/, "")
}

export function moolreConfigured(): boolean {
  return !!(process.env.MOOLRE_API_USER && process.env.MOOLRE_API_PUBKEY && process.env.MOOLRE_ACCOUNT_NUMBER)
}

export async function fetchMoolreTransaction(opts: {
  id: string
  idtype: 1 | 2
}): Promise<MoolreTx | null> {
  return (await lookupMoolreTransaction(opts)).tx
}

/**
 * Like fetchMoolreTransaction, but says whether Moolre actually answered, so
 * "no such payment" can be told apart from "could not reach Moolre".
 */
export async function lookupMoolreTransaction(opts: {
  id: string
  idtype: 1 | 2
}): Promise<{ reached: boolean; tx: MoolreTx | null }> {
  const accountnumber = process.env.MOOLRE_ACCOUNT_NUMBER
  if (!moolreConfigured()) return { reached: false, tx: null }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${moolreApiBase()}/open/transact/status`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        type: 1,
        idtype: opts.idtype,
        id: opts.id,
        accountnumber,
      }),
      signal: controller.signal,
    })
    if (!res.ok && res.status >= 500) return { reached: false, tx: null }
    const json = (await res.json()) as StatusEnvelope
    return { reached: true, tx: json?.data ?? null }
  } catch (e) {
    console.warn("[Moolre status] lookup failed:", opts, e)
    return { reached: false, tx: null }
  } finally {
    clearTimeout(timeout)
  }
}

export async function verifyMoolrePayment(refs: string[]): Promise<{
  ok: boolean
  tx: MoolreTx | null
  matchedRef: string | null
}> {
  const unique = [...new Set(refs.filter((r) => typeof r === "string" && r.length > 0))]
  for (const id of unique) {
    const idtype: 1 | 2 = /^\d+$/.test(id) ? 2 : 1
    const tx = await fetchMoolreTransaction({ id, idtype })
    if (isSuccessfulMoolreTx(tx)) {
      return { ok: true, tx, matchedRef: id }
    }
  }
  return { ok: false, tx: null, matchedRef: null }
}
