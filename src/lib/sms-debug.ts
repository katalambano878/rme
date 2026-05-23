/**
 * Ghana-oriented SMS recipient normalization (Moolre test / send).
 * Keep in sync with admin test-sms actions.
 */
export function normalizeSmsRecipient(phone: string): {
  recipient: string
  steps: string[]
  looksValidGh: boolean
} {
  const steps: string[] = []
  let cleaned = phone.replace(/\D/g, "")
  steps.push(`Input → digits only: "${cleaned}"`)

  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.slice(1)
    steps.push("Leading 0 stripped → prefixed with country code 233")
  }
  if (!cleaned.startsWith("233") && cleaned.length === 9) {
    cleaned = "233" + cleaned
    steps.push("9 digits without country code → assumed Ghana (233)")
  }

  const recipient = "+" + cleaned
  steps.push(`E.164 recipient: ${recipient}`)

  const looksValidGh = /^\+233[0-9]{9}$/.test(recipient)
  if (!looksValidGh) {
    steps.push("Warning: does not match +233 followed by 9 digits (Ghana mobile format).")
  }

  return { recipient, steps, looksValidGh }
}
