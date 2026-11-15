import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [productsRes, soldRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, sku, status, price, quantity, categories(name), variants(price, stock_quantity), product_images(url, sort_order), product_costs(cost_price, supplier_name, notes, updated_at)")
      .neq("status", "archived")
      .order("name"),
    supabaseAdmin
      .from("order_items")
      .select("product_id, quantity, orders!inner(created_at, payments(status))")
      .gte("orders.created_at", since),
  ])

  if (productsRes.error) {
    return NextResponse.json({ error: productsRes.error.message }, { status: 500 })
  }

  const sold = new Map<string, number>()
  for (const row of soldRes.data ?? []) {
    const payments = (row.orders as { payments?: { status: string }[] } | null)?.payments
    const paid = payments?.some((p) => p.status === "paid" || p.status === "completed")
    if (!paid || !row.product_id) continue
    sold.set(row.product_id, (sold.get(row.product_id) ?? 0) + (Number(row.quantity) || 0))
  }

  const products = (productsRes.data ?? []).map((p) => {
    const variants = (p.variants ?? []) as { price: number | string | null }[]
    const prices = variants.map((v) => Number(v.price)).filter((n) => n > 0)
    const productPrice = Number(p.price)
    const sellingPrice = prices.length ? Math.min(...prices) : productPrice > 0 ? productPrice : null
    const images = [...((p.product_images ?? []) as { url: string | null; sort_order: number | null }[])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    const cost = Array.isArray(p.product_costs) ? p.product_costs[0] : p.product_costs
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
    const stock = variants.length
      ? variants.reduce((sum, v) => sum + (Number((v as { stock_quantity?: number }).stock_quantity) || 0), 0)
      : Number(p.quantity) || 0
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      category: cat?.name ?? null,
      image: images[0]?.url ?? null,
      stock,
      sellingPrice,
      costPrice: cost?.cost_price != null ? Number(cost.cost_price) : null,
      supplierName: cost?.supplier_name ?? "",
      notes: cost?.notes ?? "",
      unitsSold30d: sold.get(p.id) ?? 0,
    }
  })

  return NextResponse.json({ products })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const productId = typeof body.productId === "string" ? body.productId : ""
  if (!UUID.test(productId)) return NextResponse.json({ error: "Pick a product." }, { status: 400 })

  const supplierName = typeof body.supplierName === "string" ? body.supplierName.trim().slice(0, 120) : ""
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : ""

  if (body.costPrice === null || body.costPrice === "") {
    const { error } = await supabaseAdmin.from("product_costs").delete().eq("product_id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: "Cost cleared." })
  }

  const cost = Number(body.costPrice)
  if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000) {
    return NextResponse.json({ error: "Enter what you paid the supplier, in cedis." }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from("product_costs").upsert(
    {
      product_id: productId,
      supplier_name: supplierName || null,
      cost_price: cost,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id" },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: "Cost saved." })
}
