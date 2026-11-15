import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { parseStorePricing, effectivePriceForProduct, withResolvedSalePrice } from "@/lib/effective-price"
import { isPosSale } from "@/lib/order-classification"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [productsRes, costsRes, settingsRes, recentOrdersRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, sku, status, price, sale_price, compare_at_price, quantity, metadata, categories(name), variants(price, sale_price, compare_at_price, stock_quantity), product_images(url, sort_order)")
      .neq("status", "archived")
      .order("name"),
    supabaseAdmin.from("product_costs").select("product_id, cost_price, supplier_name, notes, updated_at"),
    supabaseAdmin.from("site_settings").select("feature_flags").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("orders").select("id, notes, guest_email").gte("created_at", since),
  ])

  if (productsRes.error) return NextResponse.json({ error: productsRes.error.message }, { status: 500 })

  const recentIds = (recentOrdersRes.data ?? []).map((order) => order.id)
  const paidOrders = new Set<string>()
  if (recentIds.length) {
    const { data: payments } = await supabaseAdmin.from("payments").select("order_id, status").in("order_id", recentIds)
    for (const payment of payments ?? []) {
      if (payment.status === "paid" || payment.status === "completed") paidOrders.add(payment.order_id)
    }
    for (const order of recentOrdersRes.data ?? []) {
      if (isPosSale({ notes: order.notes, guest_email: order.guest_email })) paidOrders.add(order.id)
    }
  }
  const { data: soldRows } = paidOrders.size
    ? await supabaseAdmin.from("order_items").select("product_id, quantity, order_id").in("order_id", [...paidOrders])
    : { data: [] }
  const sold = new Map<string, number>()
  for (const row of soldRows ?? []) {
    if (!row.product_id || !paidOrders.has(row.order_id)) continue
    sold.set(row.product_id, (sold.get(row.product_id) ?? 0) + (Number(row.quantity) || 0))
  }

  const costs = new Map((costsRes.data ?? []).map((row) => [row.product_id, row]))
  const pricing = parseStorePricing(settingsRes.data?.feature_flags)

  const products = (productsRes.data ?? []).map((product) => {
    const priced = withResolvedSalePrice(product)
    const resolved = effectivePriceForProduct(priced, pricing)
    const variants = (product.variants ?? []) as { stock_quantity?: number }[]
    const stock = variants.length
      ? variants.reduce((sum, variant) => sum + (Number(variant.stock_quantity) || 0), 0)
      : Number(product.quantity) || 0
    const images = [...((product.product_images ?? []) as { url: string | null; sort_order: number | null }[])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    const category = Array.isArray(product.categories) ? product.categories[0] : product.categories
    const cost = costs.get(product.id)
    const regularPrice = resolved.original > 0 ? resolved.original : Number(product.price) || 0
    const sellingPrice = resolved.effective > 0 ? resolved.effective : regularPrice
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      status: product.status,
      category: category?.name ?? null,
      image: images[0]?.url ?? null,
      stock,
      regularPrice,
      sellingPrice,
      onPromotion: resolved.onSale,
      costPrice: cost?.cost_price != null ? Number(cost.cost_price) : null,
      supplierName: cost?.supplier_name ?? null,
      notes: cost?.notes ?? null,
      costUpdatedAt: cost?.updated_at ?? null,
      unitsSold30d: sold.get(product.id) ?? 0,
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
