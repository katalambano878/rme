import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { syncProductMedia } from "@/lib/data/catalog-sync"

export const runtime = "nodejs"

const PRODUCT_SELECT = `
  p.*,
  CASE WHEN c.id IS NULL THEN NULL
       ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
  END AS categories,
  COALESCE(
    (SELECT jsonb_agg(
       jsonb_build_object('id', pi.id, 'url', pi.url, 'sort_order', pi.sort_order, 'alt', pi.alt)
       ORDER BY pi.sort_order
     ) FROM product_images pi WHERE pi.product_id = p.id),
    '[]'::jsonb
  ) AS product_images,
  COALESCE(
    (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at)
     FROM variants v WHERE v.product_id = p.id),
    '[]'::jsonb
  ) AS variants,
  (SELECT COUNT(*)::int FROM variants v WHERE v.product_id = p.id) AS variants_count
`

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const sort = searchParams.get("sort") || "newest"
  const search = searchParams.get("q")?.trim()
  const includeSales = searchParams.get("includeSales") === "1"

  const auth = await verifyAuth(request, { requireAdmin: true })
  const isStaff = auth.authenticated

  if (status && status !== "active" && !isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params: unknown[] = []
  const where: string[] = []

  const effectiveStatus = status || (isStaff ? null : "active")
  if (effectiveStatus && effectiveStatus !== "all") {
    params.push(effectiveStatus)
    where.push(`p.status = $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    where.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`)
  }

  let orderSql = "p.created_at DESC"
  if (sort === "price_asc") orderSql = "p.price ASC NULLS LAST"
  if (sort === "price_desc") orderSql = "p.price DESC NULLS LAST"
  if (sort === "name") orderSql = "p.name ASC"
  if (sort === "stock") orderSql = "p.quantity ASC NULLS LAST"

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

  try {
    const result = await query(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${orderSql}`,
      params,
    )

    let salesMap: Record<string, number> = {}
    if (includeSales && isStaff) {
      const sales = await query<{ product_id: string; qty: string }>(
        `SELECT product_id, SUM(quantity)::text AS qty
         FROM order_items
         WHERE product_id IS NOT NULL
         GROUP BY product_id`,
      )
      salesMap = Object.fromEntries(
        sales.rows.map((r) => [r.product_id, Number(r.qty) || 0]),
      )
    }

    const rows = result.rows.map((row) =>
      includeSales ? { ...row, sales_count: salesMap[String(row.id)] ?? 0 } : row,
    )

    return NextResponse.json(rows)
  } catch (err: unknown) {
    console.error("[catalog/products GET]", err)
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      slug,
      price,
      category_id,
      status = "draft",
      description,
      short_description,
      quantity = 0,
      sale_price,
      compare_at_price,
      is_featured = false,
      metadata = {},
      sku,
      seo_title,
      seo_description,
      tags,
      moq = 1,
    } = body

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 })
    }

    const created = await queryOne(
      `INSERT INTO products (
         name, slug, price, category_id, status, description, short_description,
         quantity, sale_price, compare_at_price, is_featured, metadata, sku,
         seo_title, seo_description, tags, moq
       )
       VALUES (
         $1, $2, $3, $4::uuid, $5, $6, $7,
         $8, $9, $10, $11, $12::jsonb, $13,
         $14, $15, $16::text[], $17
       )
       RETURNING *`,
      [
        name,
        slug,
        price ?? null,
        category_id || null,
        status,
        description || null,
        short_description || null,
        quantity,
        sale_price ?? null,
        compare_at_price ?? null,
        is_featured,
        JSON.stringify(metadata),
        sku || null,
        seo_title || null,
        seo_description || null,
        Array.isArray(tags) ? tags : [],
        moq,
      ],
    )

    if (!created) {
      return NextResponse.json({ error: "Create failed" }, { status: 500 })
    }

    if (body.images || body.variants) {
      await syncProductMedia(String(created.id), body.images, body.variants)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
