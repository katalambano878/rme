import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { isPosSale } from "@/lib/order-classification"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

function dayRange(raw: string | null) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" })
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today
  return { day, start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` }
}

function paid(payments: { status: string }[] | null | undefined) {
  return !!payments?.some((p) => p.status === "paid" || p.status === "completed")
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { day, start, end } = dayRange(request.nextUrl.searchParams.get("date"))
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, grand_total, discount_total, notes, guest_email, created_at, payments(status, provider), order_items(name_snapshot, quantity, line_total)")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = data ?? []
  let paidOrders = 0
  let unpaidOrders = 0
  let cancelledOrders = 0
  let posOrders = 0
  let webOrders = 0
  let revenue = 0
  let posRevenue = 0
  let webRevenue = 0
  let discounts = 0
  let toFulfil = 0
  const byMethod = new Map<string, { orders: number; revenue: number; channel: string }>()
  const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>()

  for (const order of orders) {
    const isPos = isPosSale({ notes: order.notes, guest_email: order.guest_email })
    const isPaid = paid(order.payments as { status: string }[] | null) || isPos
    const status = String(order.status || "")
    const total = Number(order.grand_total) || 0
    if (status === "cancelled") {
      cancelledOrders += 1
      continue
    }
    if (!isPaid) {
      unpaidOrders += 1
      continue
    }
    paidOrders += 1
    revenue += total
    discounts += Number(order.discount_total) || 0
    if (!["shipped", "delivered", "cancelled"].includes(status)) toFulfil += 1
    if (isPos) {
      posOrders += 1
      posRevenue += total
    } else {
      webOrders += 1
      webRevenue += total
    }
    const provider = (order.payments as { provider?: string }[] | null)?.[0]?.provider || (isPos ? "pos" : "other")
    const key = `${isPos ? "POS" : "Website"}:${provider}`
    const bucket = byMethod.get(key) ?? { orders: 0, revenue: 0, channel: isPos ? "POS" : "Website" }
    bucket.orders += 1
    bucket.revenue += total
    byMethod.set(key, bucket)

    for (const item of (order.order_items ?? []) as { name_snapshot: string; quantity: number; line_total: number }[]) {
      const name = item.name_snapshot || "Item"
      const row = byProduct.get(name) ?? { name, quantity: 0, revenue: 0 }
      row.quantity += Number(item.quantity) || 0
      row.revenue += Number(item.line_total) || 0
      byProduct.set(name, row)
    }
  }

  return NextResponse.json({
    day,
    totals: {
      paidOrders,
      unpaidOrders,
      cancelledOrders,
      posOrders,
      webOrders,
      revenue,
      posRevenue,
      webRevenue,
      discounts,
      toFulfil,
    },
    payments: [...byMethod.entries()].map(([key, row]) => ({
      method: key.split(":")[1],
      channel: row.channel,
      orders: row.orders,
      revenue: row.revenue,
    })),
    products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    orders: orders.slice(0, 40).map((order) => ({
      id: order.id,
      number: order.order_number,
      total: Number(order.grand_total) || 0,
      status: order.status,
      pos: isPosSale({ notes: order.notes, guest_email: order.guest_email }),
    })),
  })
}
