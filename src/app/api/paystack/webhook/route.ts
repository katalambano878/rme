import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || secretKey
  if (!webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const rawBody = await req.text()

  const signature = req.headers.get("x-paystack-signature")
  if (!signature) {
    console.error("Paystack webhook: missing signature header")
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }
  const hash = createHmac("sha512", webhookSecret).update(rawBody).digest("hex")
  if (hash !== signature) {
    console.error("Paystack webhook: invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    if (event.event === "charge.success") {
      const tx = event.data
      const reference = tx.reference as string

      await supabase
        .from("payments")
        .update({
          status: "paid",
          raw_payload: tx,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_ref", reference)

      await supabase
        .from("orders")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("order_number", reference)

      await supabase.from("webhook_logs").insert({
        provider: "paystack",
        event_type: event.event,
        payload: event,
      }).then(() => {})
    }
  } catch (err) {
    console.error("Paystack webhook processing error:", err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
