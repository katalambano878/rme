import { sendOrderConfirmation } from "@/lib/notifications"
import { reduceOrderStock } from "@/lib/order-stock"
import { amountMatchesOrder } from "@/lib/moolre-status"

type AdminClient = {
  from: (table: string) => any
}

export type FulfillOrder = {
  id: string
  order_number: string
  grand_total: number
  guest_email?: string | null
  guest_phone?: string | null
  shipping_address?: unknown
  payments?: { status: string }[] | null
}

export function stripRetrySuffix(ref: string): string {
  return ref.replace(/-R\d+$/, "")
}

export function ghanaPhoneFromPayer(payer?: string | null): string | null {
  const digits = String(payer || "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("233") && digits.length >= 12) return `0${digits.slice(3)}`
  if (digits.startsWith("0")) return digits
  return digits
}

async function findOrderByNumber(
  supabase: AdminClient,
  orderNumber: string,
): Promise<FulfillOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, grand_total, guest_email, guest_phone, shipping_address, payments(status)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle()

  if (error) {
    console.error("[Moolre fulfill] lookup failed:", orderNumber, error.message)
    return null
  }
  return (data as FulfillOrder | null) ?? null
}

async function recoverMissingOrder(
  supabase: AdminClient,
  opts: {
    orderNumber: string
    amount: number
    email?: string | null
    phone?: string | null
    rawPayload?: unknown
  },
): Promise<FulfillOrder | null> {
  let shippingAddress: Record<string, unknown> = {
    firstName: "",
    lastName: "",
    address1: "Confirm address with customer — order recovered from payment",
    city: "",
    region: "",
    country: "Ghana",
    postalCode: "",
  }

  if (opts.email) {
    const { data: prior } = await supabase
      .from("orders")
      .select("shipping_address, guest_phone")
      .eq("guest_email", opts.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prior?.shipping_address && typeof prior.shipping_address === "object") {
      shippingAddress = {
        ...(prior.shipping_address as Record<string, unknown>),
      }
    }
  }

  const notes =
    "Recovered from Moolre payment because the original checkout row was missing. Confirm items and address before dispatch."

  const { data: created, error: insertErr } = await supabase
    .from("orders")
    .insert({
      order_number: opts.orderNumber,
      guest_email: opts.email || null,
      guest_phone: opts.phone || null,
      status: "paid",
      subtotal: opts.amount,
      shipping_total: 0,
      discount_total: 0,
      tax_total: 0,
      grand_total: opts.amount,
      currency: "GHS",
      shipping_address: shippingAddress,
      billing_address: shippingAddress,
      notes,
    })
    .select("id, order_number, grand_total, guest_email, guest_phone, shipping_address")
    .maybeSingle()

  if (insertErr || !created) {
    // Race: another callback may have inserted it first.
    const raced = await findOrderByNumber(supabase, opts.orderNumber)
    if (raced) return raced
    console.error("[Moolre fulfill] recover insert failed:", opts.orderNumber, insertErr?.message)
    return null
  }

  console.warn("[Moolre fulfill] recovered missing order", opts.orderNumber, {
    amount: opts.amount,
    email: opts.email,
    phone: opts.phone,
  })
  return {
    ...created,
    payments: [],
  }
}

export async function fulfillMoolrePaidOrder(
  supabase: AdminClient,
  opts: {
    orderNumber: string
    paidAmount: number
    providerRef: string
    rawPayload?: unknown
    email?: string | null
    phone?: string | null
    notify?: boolean
  },
): Promise<{ ok: boolean; created: boolean; alreadyPaid: boolean; order: FulfillOrder | null; message: string }> {
  const orderNumber = stripRetrySuffix(opts.orderNumber.trim())
  let order = await findOrderByNumber(supabase, orderNumber)
  let created = false

  if (!order) {
    if (!Number.isFinite(opts.paidAmount) || opts.paidAmount <= 0) {
      return {
        ok: false,
        created: false,
        alreadyPaid: false,
        order: null,
        message: "Order not found and payment amount missing",
      }
    }
    order = await recoverMissingOrder(supabase, {
      orderNumber,
      amount: opts.paidAmount,
      email: opts.email,
      phone: opts.phone,
      rawPayload: opts.rawPayload,
    })
    created = !!order
  }

  if (!order) {
    return {
      ok: false,
      created: false,
      alreadyPaid: false,
      order: null,
      message: "Order not found",
    }
  }

  const alreadyPaid = (order.payments || []).some(
    (p) => p.status === "paid" || p.status === "completed",
  )
  if (alreadyPaid) {
    return { ok: true, created, alreadyPaid: true, order, message: "Order already paid" }
  }

  if (!created && !amountMatchesOrder(opts.paidAmount, Number(order.grand_total))) {
    return {
      ok: false,
      created,
      alreadyPaid: false,
      order,
      message: "Payment amount does not match order total",
    }
  }

  const { data: existingPay } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("provider", "moolre")
    .maybeSingle()

  const payPayload = {
    order_id: order.id,
    provider: "moolre" as const,
    provider_ref: String(opts.providerRef),
    amount: Number(order.grand_total),
    currency: "GHS",
    status: "paid" as const,
    updated_at: new Date().toISOString(),
    raw_payload: opts.rawPayload ?? null,
  }

  if (existingPay?.id) {
    const { error } = await supabase.from("payments").update(payPayload).eq("id", existingPay.id)
    if (error) console.error("[Moolre fulfill] payment update:", error.message)
  } else {
    const { error } = await supabase.from("payments").insert(payPayload)
    if (error) console.error("[Moolre fulfill] payment insert:", error.message)
  }

  const { error: orderUpdateErr } = await supabase
    .from("orders")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", order.id)
  if (orderUpdateErr) console.error("[Moolre fulfill] order update:", orderUpdateErr.message)

  try {
    const stockResult = await reduceOrderStock(supabase as any, order.id)
    if (stockResult.skipped) {
      console.log("[Moolre fulfill] stock skipped", orderNumber)
    } else if (stockResult.errors.length) {
      console.error("[Moolre fulfill] stock errors:", stockResult.errors)
    }
  } catch (e: unknown) {
    console.error("[Moolre fulfill] stock crashed:", e)
  }

  if (opts.notify !== false) {
    try {
      await sendOrderConfirmation({
        ...order,
        email: order.guest_email,
        phone: order.guest_phone || opts.phone,
        total: order.grand_total,
        created_at: new Date().toISOString(),
      })
    } catch (e: unknown) {
      console.error("[Moolre fulfill] notify failed:", e)
    }
  }

  return { ok: true, created, alreadyPaid: false, order, message: "Payment verified and order updated" }
}
