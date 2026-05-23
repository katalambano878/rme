import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { primaryImageFromDbRows } from "@/lib/product-image"
import { listPriceFromProduct } from "@/lib/product-metrics"
import type { ProductSearchResult } from "@/types/product-search"

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 1) {
    return NextResponse.json({ results: [] satisfies ProductSearchResult[] })
  }
  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 })
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return NextResponse.json({ results: [], error: "Search unavailable" })
  }

  const safe = escapeIlikePattern(q.replace(/,/g, " "))
  const pattern = `%${safe}%`

  const productSelect = `
    id,
    name,
    slug,
    price,
    quantity,
    product_images ( url, storage_path, sort_order ),
    variants ( price )
  ` as const

  const [byName, bySlug] = await Promise.all([
    supabase
      .from("products")
      .select(productSelect)
      .eq("status", "active")
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(16),
    supabase
      .from("products")
      .select(productSelect)
      .eq("status", "active")
      .ilike("slug", pattern)
      .order("name", { ascending: true })
      .limit(16),
  ])

  if (byName.error || bySlug.error) {
    console.error("Product search error:", byName.error ?? bySlug.error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }

  const merged = new Map<string, (typeof byName.data)[number]>()
  for (const row of [...(byName.data ?? []), ...(bySlug.data ?? [])]) {
    if (row?.id && !merged.has(row.id)) merged.set(row.id, row)
  }
  const rows = [...merged.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  ).slice(0, 16)

  const results: ProductSearchResult[] = rows.map((row) => {
    const r = row as { variants?: { price: number }[] | null; price?: number | null; quantity?: number | null }
    const minPrice = listPriceFromProduct(r) || null

    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      imageUrl: primaryImageFromDbRows(
        row.product_images as Parameters<typeof primaryImageFromDbRows>[0],
      ),
      minPrice,
    }
  })

  return NextResponse.json({ results })
}
