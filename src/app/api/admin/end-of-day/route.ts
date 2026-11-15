import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { isPosSale } from "@/lib/order-classification"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

type OrderRow = {
  id: string
  order_number: string
  status: string
  grand_total: number | string
  discount_total: number | string | null
  notes: string | null
  guest_email: string | null
  guest_phone: string | null
  shipping_address: { firstName?: string; lastName?: string; first_name?: string; last_name?: string } | null
  created_at: string
  payments: { status: string; provider: string | null }[] | null
  order_items: { product_id: string | null; name_snapshot: string; quantity: number; line_total: number }[] | null
}

function dayRange(raw: string | null) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" })
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today
  const start = new Date(`${day}T00:00:00.000Z`)
  const from = new Date(start)
  from.setUTCDate(from.getUTCDate() - 7)
  return { day, start: start.toISOString(), end: `${day}T23:59:59.999Z`, from: from.toISOString() }
}

function isPaid(order: OrderRow) {
  return isPosSale(order) || !!order.payments?.some((p) => p.status === "paid" || p.status === "completed")
}

function customerName(order: OrderRow) {
  const address = order.shipping_address
  const name = [address?.firstName || address?.first_name, address?.lastName || address?.last_name].filter(Boolean).join(" ")
  return name || order.guest_phone || order.guest_email || ""
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })

  const { day, start, end, from } = dayRange(request.nextUrl.searchParams.get("date"))
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, grand_total, discount_total, notes, guest_email, guest_phone, shipping_address, created_at, payments(status, provider), order_items(product_id, name_snapshot, quantity, line_total)")
    .gte("created_at", from)
    .lte("created_at", end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data ?? []) as OrderRow[]
  const onDay = orders.filter((order) => order.created_at >= start && order.created_at <= end)
  const paidOnDay = onDay.filter((order) => order.status !== "cancelled" && isPaid(order))

  const productIds = [...new Set(paidOnDay.flatMap((order) => (order.order_items ?? []).map((item) => item.product_id).filter(Boolean)))] as string[]
  const [{ data: products }, { data: costs }] = await Promise.all([
    productIds.length ? supabaseAdmin.from("products").select("id, quantity, variants(stock_quantity)").in("id", productIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabaseAdmin.from("product_costs").select("product_id, cost_price").in("product_id", productIds) : Promise.resolve({ data: [] }),
  ])
  const stockOf = new Map<string, number>()
  for (const product of products ?? []) {
    const variants = (product.variants ?? []) as { stock_quantity?: number }[]
    stockOf.set(product.id, variants.length ? variants.reduce((sum, variant) => sum + (Number(variant.stock_quantity) || 0), 0) : Number(product.quantity) || 0)
  }
  const costOf = new Map((costs ?? []).map((row) => [row.product_id, Number(row.cost_price)]))

  let unpaid = 0
  let cancelled = 0
  let discounts = 0
  let toFulfil = 0
  const payments = new Map<string, { method: string; channel: string; orders: number; revenue: number }>()
  const items = new Map<string, { productId: string | null; name: string; units: number; posUnits: number; webUnits: number; revenue: number; stockLeft: number | null; profit: number | null }>()
  const staff = new Map<string, { name: string; orders: number; revenue: number; units: number }>()

  for (const order of onDay) {
    if (order.status === "cancelled") { cancelled += 1; continue }
    if (!isPaid(order)) { unpaid += 1; continue }
    const pos = isPosSale(order)
    const total = Number(order.grand_total) || 0
    discounts += Number(order.discount_total) || 0
    if (!["shipped", "delivered"].includes(order.status)) toFulfil += 1
    const provider = order.payments?.[0]?.provider || (pos ? "cash" : "other")
    const pay = payments.get(`${provider}:${pos ? "POS" : "Website"}`) ?? { method: provider, channel: pos ? "POS" : "Website", orders: 0, revenue: 0 }
    pay.orders += 1
    pay.revenue += total
    payments.set(`${provider}:${pay.channel}`, pay)

    let units = 0
    for (const item of order.order_items ?? []) {
      units += Number(item.quantity) || 0
      const key = item.product_id || item.name_snapshot
      const row = items.get(key) ?? {
        productId: item.product_id,
        name: item.name_snapshot,
        units: 0,
        posUnits: 0,
        webUnits: 0,
        revenue: 0,
        stockLeft: item.product_id ? stockOf.get(item.product_id) ?? null : null,
        profit: null,
      }
      row.units += Number(item.quantity) || 0
      row.revenue += Number(item.line_total) || 0
      if (pos) row.posUnits += Number(item.quantity) || 0
      else row.webUnits += Number(item.quantity) || 0
      items.set(key, row)
    }
    if (pos) {
      const name = "Counter"
      const person = staff.get(name) ?? { name, orders: 0, revenue: 0, units: 0 }
      person.orders += 1
      person.revenue += total
      person.units += units
      staff.set(name, person)
    }
  }

  const revenue = paidOnDay.reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0)
  const posRevenue = paidOnDay.filter((order) => isPosSale(order)).reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0)
  const itemRows = [...items.values()].map((item) => {
    const cost = item.productId ? costOf.get(item.productId) : undefined
    return { ...item, profit: cost == null ? null : item.revenue - cost * item.units }
  })
  const costed = itemRows.filter((item) => item.profit != null)
  const sumPaid = (list: OrderRow[]) => list.filter((order) => order.status !== "cancelled" && isPaid(order)).reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0)
  const yesterdayStart = new Date(start)
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)
  const weekStart = new Date(start)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 1)

  return NextResponse.json({
    day,
    summary: {
      paidOrders: paidOnDay.length,
      unpaidOrders: unpaid,
      cancelledOrders: cancelled,
      posOrders: paidOnDay.filter((order) => isPosSale(order)).length,
      webOrders: paidOnDay.filter((order) => !isPosSale(order)).length,
      revenue,
      posRevenue,
      webRevenue: revenue - posRevenue,
      discounts,
      toFulfil,
      unitsSold: itemRows.reduce((sum, item) => sum + item.units, 0),
      averageOrder: paidOnDay.length ? revenue / paidOnDay.length : 0,
      profit: costed.length ? costed.reduce((sum, item) => sum + (item.profit || 0), 0) : null,
      profitCoverage: itemRows.length ? costed.length / itemRows.length : 0,
    },
    comparison: {
      yesterday: sumPaid(orders.filter((order) => order.created_at >= yesterdayStart.toISOString() && order.created_at < start)),
      lastWeek: sumPaid(orders.filter((order) => order.created_at >= weekStart.toISOString() && order.created_at < weekEnd.toISOString())),
    },
    payments: [...payments.values()].sort((a, b) => b.revenue - a.revenue),
    items: itemRows.sort((a, b) => b.revenue - a.revenue),
    lowStock: itemRows.filter((item) => item.stockLeft != null && item.stockLeft <= 5).map((item) => ({ name: item.name, stockLeft: item.stockLeft })),
    staff: [...staff.values()],
    orders: onDay.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      total: Number(order.grand_total) || 0,
      payment_status: isPaid(order) ? "paid" : order.status === "cancelled" ? "cancelled" : "pending",
      payment_method: order.payments?.[0]?.provider || null,
      status: order.status,
      created_at: order.created_at,
      staff_name: isPosSale(order) ? "Counter" : null,
      channel: isPosSale(order) ? "POS" : "Website",
      customer: customerName(order),
    })),
  })
}
