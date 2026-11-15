import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { isPosSale } from "@/lib/order-classification"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const ACTIVE_WINDOW_SECONDS = 90
const hits = new Map<string, { n: number; reset: number }>()

function stageFor(page: string, cartItems: number): string {
  if (page.startsWith("/checkout")) return "checkout"
  if (page.startsWith("/cart")) return "cart"
  if (cartItems > 0) return "has_bag"
  if (page.startsWith("/products/")) return "viewing_product"
  return "browsing"
}

function allowed(ip: string): boolean {
  const now = Date.now()
  const row = hits.get(ip)
  if (!row || row.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    return true
  }
  row.n += 1
  return row.n <= 30
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (!allowed(ip)) return new NextResponse(null, { status: 204 })

  const body = await request.json().catch(() => null)
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.slice(0, 64) : ""
  if (!/^[a-z0-9-]{8,64}$/i.test(visitorId)) {
    return NextResponse.json({ error: "Invalid visitor" }, { status: 400 })
  }
  const page = typeof body?.page === "string" && body.page.startsWith("/") ? body.page.slice(0, 200) : "/"
  if (page.startsWith("/admin")) return new NextResponse(null, { status: 204 })

  const cartItems = Math.max(0, Math.min(999, Math.floor(Number(body?.cartItems) || 0)))
  const cartValue = Math.max(0, Math.min(1_000_000, Number(body?.cartValue) || 0))

  const { error } = await supabaseAdmin.from("live_sessions").upsert(
    {
      visitor_id: visitorId,
      page,
      stage: stageFor(page, cartItems),
      cart_items: cartItems,
      cart_value: cartValue,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "visitor_id" },
  )
  if (error) console.error("[live] ping failed", error.message)

  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { data: seen } = await supabaseAdmin
    .from("site_visits")
    .select("id")
    .eq("visitor_id", visitorId)
    .gte("visited_at", start.toISOString())
    .limit(1)
  if (!seen?.length) {
    await supabaseAdmin.from("site_visits").insert({ visitor_id: visitorId })
  }

  return new NextResponse(null, { status: 204 })
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000).toISOString()
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const [sessionsRes, visitsRes, ordersRes] = await Promise.all([
    supabaseAdmin
      .from("live_sessions")
      .select("visitor_id, page, stage, cart_items, cart_value, last_seen")
      .gt("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(300),
    supabaseAdmin.from("site_visits").select("visitor_id").gte("visited_at", dayStart.toISOString()),
    supabaseAdmin
      .from("orders")
      .select("grand_total, notes, guest_email, payments(status)")
      .gte("created_at", dayStart.toISOString()),
  ])

  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 })
  }

  const rows = (sessionsRes.data ?? []).map((r) => ({
    id: String(r.visitor_id).slice(-6),
    page: r.page as string,
    stage: r.stage as string,
    cartItems: Number(r.cart_items) || 0,
    cartValue: Number(r.cart_value) || 0,
    lastSeen: r.last_seen as string,
  }))

  const visitors = new Set((visitsRes.data ?? []).map((v) => v.visitor_id)).size
  let webOrders = 0
  let webRevenue = 0
  for (const order of ordersRes.data ?? []) {
    const isPos = isPosSale({ notes: order.notes as string | null, guest_email: order.guest_email as string | null })
    const paid = (order.payments as { status: string }[] | null)?.some(
      (p) => p.status === "paid" || p.status === "completed",
    )
    if (!paid || isPos) continue
    webOrders += 1
    webRevenue += Number(order.grand_total) || 0
  }

  return NextResponse.json({
    windowSeconds: ACTIVE_WINDOW_SECONDS,
    online: rows.length,
    withBag: rows.filter((r) => r.cartItems > 0).length,
    atCheckout: rows.filter((r) => r.stage === "checkout").length,
    bagValue: rows.reduce((sum, r) => sum + r.cartValue, 0),
    today: { visitors, webOrders, webRevenue },
    sessions: rows,
  })
}
