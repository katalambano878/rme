import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { primaryImageFromDbRows } from "@/lib/product-image"
import { listPriceFromProduct } from "@/lib/product-metrics"
import type { ProductSearchResult } from "@/types/product-search"

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

type SearchProductRow = {
  id: string
  name: string
  slug: string
  price: number | string | null
  quantity: number | null
  product_images: Parameters<typeof primaryImageFromDbRows>[0]
  variants: { price: number | string | null }[] | null
}

const SEARCH_SELECT_SQL = `
SELECT
  p.id,
  p.name,
  p.slug,
  p.price,
  p.quantity,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', pi.url,
          'storage_path', pi.storage_path,
          'sort_order', pi.sort_order
        )
      )
      FROM product_images pi
      WHERE pi.product_id = p.id
    ),
    '[]'::jsonb
  ) AS product_images,
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object('price', v.price))
      FROM variants v
      WHERE v.product_id = p.id
    ),
    '[]'::jsonb
  ) AS variants
FROM products p
`

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 1) {
    return NextResponse.json({ results: [] satisfies ProductSearchResult[] })
  }
  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 })
  }

  const safe = escapeIlikePattern(q.replace(/,/g, " "))
  const pattern = `%${safe}%`

  try {
    const [byName, bySlug] = await Promise.all([
      query<SearchProductRow>(
        `${SEARCH_SELECT_SQL}
         WHERE p.status = 'active' AND p.name ILIKE $1 ESCAPE '\\'
         ORDER BY p.name ASC
         LIMIT 16`,
        [pattern],
      ),
      query<SearchProductRow>(
        `${SEARCH_SELECT_SQL}
         WHERE p.status = 'active' AND p.slug ILIKE $1 ESCAPE '\\'
         ORDER BY p.name ASC
         LIMIT 16`,
        [pattern],
      ),
    ])

    const merged = new Map<string, SearchProductRow>()
    for (const row of [...byName.rows, ...bySlug.rows]) {
      if (row?.id && !merged.has(row.id)) merged.set(row.id, row)
    }
    const rows = [...merged.values()]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, 16)

    const results: ProductSearchResult[] = rows.map((row) => {
      const minPrice = listPriceFromProduct(row) || null

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        imageUrl: primaryImageFromDbRows(row.product_images),
        minPrice,
      }
    })

    return NextResponse.json({ results })
  } catch (err) {
    console.error("Product search error:", err)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
