import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { parseStorePricing } from "@/lib/effective-price"
import {
  markdownPrice,
  readMarkdown,
  type MarkdownType,
  type ProductMarkdown,
} from "@/lib/admin-product-markdown"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && UUID.test(v)).slice(0, 500)
    : []
}

async function storeSaleRunning(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("feature_flags")
    .eq("id", 1)
    .maybeSingle()
  return parseStorePricing(data?.feature_flags).salesActive
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const [productsRes, categoriesRes, saleRunning] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, status, price, compare_at_price, sale_price, category_id, metadata, categories(name), variants(id, price, compare_at_price, sale_price), product_images(url, sort_order)",
      )
      .neq("status", "archived")
      .order("name"),
    supabaseAdmin.from("categories").select("id, name").order("name"),
    storeSaleRunning(),
  ])

  if (productsRes.error) {
    return NextResponse.json({ error: productsRes.error.message }, { status: 500 })
  }

  const products = (productsRes.data ?? []).map((p: {
    id: string
    name: string
    sku: string | null
    status: string
    price: number | string | null
    compare_at_price: number | string | null
    category_id: string | null
    metadata: unknown
    categories: { name: string } | { name: string }[] | null
    variants: unknown[] | null
    product_images: { url: string | null; sort_order: number | null }[] | null
  }) => {
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
    const images = [...(p.product_images ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      price: Number(p.price) || 0,
      compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
      category_id: p.category_id,
      category: cat?.name ?? null,
      markdown: readMarkdown(p.metadata),
      variant_count: (p.variants ?? []).length,
      image: images[0]?.url ?? null,
    }
  })

  products.sort((a: { markdown: unknown; name: string }, b: { markdown: unknown; name: string }) =>
    Number(Boolean(b.markdown)) - Number(Boolean(a.markdown)) || a.name.localeCompare(b.name),
  )

  return NextResponse.json({
    products,
    categories: categoriesRes.data ?? [],
    storeSaleRunning: saleRunning,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const type: MarkdownType = body.type === "fixed" ? "fixed" : "percent"
  const value = Number(body.value)
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Enter how much to take off." }, { status: 400 })
  }
  if (type === "percent" && value >= 90) {
    return NextResponse.json({ error: "Keep percentage markdowns below 90%." }, { status: 400 })
  }
  if (await storeSaleRunning()) {
    return NextResponse.json(
      { error: "A whole-store sale is on. Turn it off first so products are not discounted twice." },
      { status: 409 },
    )
  }

  const productIds = ids(body.productIds)
  if (productIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one product." }, { status: 400 })
  }

  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, price, compare_at_price, sale_price, metadata, variants(id, price, compare_at_price, sale_price)")
    .in("id", productIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appliedAt = new Date().toISOString()
  const applied: string[] = []
  const skipped: string[] = []

  for (const p of products ?? []) {
    const previous = readMarkdown(p.metadata)
    const base = previous?.original_price ?? (Number(p.price) || 0)
    const next = markdownPrice(base, type, value)
    if (!(base > 0) || next <= 0) {
      skipped.push(p.name)
      continue
    }

    const variants = (p.variants ?? []) as {
      id: string
      price: number | string | null
      compare_at_price: number | string | null
      sale_price: number | string | null
    }[]
    const variantSnap: NonNullable<ProductMarkdown["variants"]> = {
      ...(previous?.variants ?? {}),
    }
    for (const v of variants) {
      const prevV = previous?.variants?.[v.id]
      const vBase = prevV?.original_price ?? (Number(v.price) || 0)
      const vNext = markdownPrice(vBase, type, value)
      if (!(vBase > 0) || vNext <= 0) continue
      variantSnap[v.id] = {
        original_price: vBase,
        original_compare_at: prevV ? prevV.original_compare_at : v.compare_at_price != null ? Number(v.compare_at_price) : null,
        original_sale_price: prevV ? prevV.original_sale_price : v.sale_price != null ? Number(v.sale_price) : null,
      }
      const { error: ve } = await supabaseAdmin
        .from("variants")
        .update({
          price: vNext,
          compare_at_price: vBase,
          sale_price: null,
        })
        .eq("id", v.id)
      if (ve) return NextResponse.json({ error: ve.message }, { status: 500 })
    }

    const markdown: ProductMarkdown = {
      original_price: base,
      original_compare_at: previous ? previous.original_compare_at : p.compare_at_price != null ? Number(p.compare_at_price) : null,
      original_sale_price: previous ? previous.original_sale_price : p.sale_price != null ? Number(p.sale_price) : null,
      variants: variantSnap,
      type,
      value,
      applied_at: appliedAt,
    }

    const meta = p.metadata && typeof p.metadata === "object" ? { ...(p.metadata as Record<string, unknown>) } : {}
    const { error: pe } = await supabaseAdmin
      .from("products")
      .update({
        price: next,
        compare_at_price: base,
        sale_price: null,
        metadata: { ...meta, discount: markdown },
      })
      .eq("id", p.id)
    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
    applied.push(p.name)
  }

  const off = type === "percent" ? `${value}%` : `GH₵${value.toFixed(2)}`
  return NextResponse.json({
    message:
      `${off} off ${applied.length} product${applied.length === 1 ? "" : "s"}.` +
      (skipped.length ? ` Skipped ${skipped.join(", ")} because the price would drop to zero.` : ""),
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const productIds = body.all === true ? null : ids(body.productIds)
  if (productIds && productIds.length === 0) {
    return NextResponse.json({ error: "Choose which markdowns to end." }, { status: 400 })
  }

  let query = supabaseAdmin
    .from("products")
    .select("id, metadata, variants(id)")
  if (productIds) query = query.in("id", productIds)

  const { data: products, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let restored = 0
  for (const p of products ?? []) {
    const markdown = readMarkdown(p.metadata)
    if (!markdown) continue

    for (const [variantId, snap] of Object.entries(markdown.variants ?? {})) {
      await supabaseAdmin
        .from("variants")
        .update({
          price: snap.original_price,
          compare_at_price: snap.original_compare_at,
          sale_price: snap.original_sale_price,
        })
        .eq("id", variantId)
    }

    const meta = { ...((p.metadata as Record<string, unknown>) ?? {}) }
    delete meta.discount
    const { error: pe } = await supabaseAdmin
      .from("products")
      .update({
        price: markdown.original_price,
        compare_at_price: markdown.original_compare_at,
        sale_price: markdown.original_sale_price,
        metadata: meta,
      })
      .eq("id", p.id)
    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
    restored += 1
  }

  return NextResponse.json({
    message: `Original prices are back on ${restored} product${restored === 1 ? "" : "s"}.`,
  })
}
