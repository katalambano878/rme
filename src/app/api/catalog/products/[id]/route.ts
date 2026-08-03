import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { syncProductMedia } from "@/lib/data/catalog-sync"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

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
  ) AS variants
`

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params
  try {
    const row = await queryOne(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id::text = $1 OR p.slug = $1
       LIMIT 1`,
      [id],
    )
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(row)
  } catch (err: unknown) {
    console.error("[catalog/products/[id] GET]", err)
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()
  const { images, variants, ...fields } = body

  const allowed = [
    "name",
    "slug",
    "description",
    "short_description",
    "price",
    "sale_price",
    "compare_at_price",
    "sku",
    "quantity",
    "moq",
    "category_id",
    "status",
    "is_featured",
    "is_new_arrival",
    "is_best_seller",
    "badges",
    "metadata",
    "tags",
    "seo_title",
    "seo_description",
    "delivery_estimate",
  ] as const

  const sets: string[] = []
  const params: unknown[] = [id]
  let i = 2

  for (const key of allowed) {
    if (key in fields) {
      if (key === "metadata") {
        sets.push(`${key} = $${i}::jsonb`)
        params.push(JSON.stringify(fields[key]))
      } else if (key === "category_id") {
        sets.push(`${key} = $${i}::uuid`)
        params.push(fields[key] || null)
      } else if (key === "tags" || key === "badges") {
        sets.push(`${key} = $${i}::text[]`)
        params.push(Array.isArray(fields[key]) ? fields[key] : [])
      } else {
        sets.push(`${key} = $${i}`)
        params.push(fields[key])
      }
      i++
    }
  }

  if (!sets.length && !images && !variants) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  sets.push("updated_at = now()")

  try {
    let updated = null
    if (sets.length) {
      updated = await queryOne(
        `UPDATE products SET ${sets.join(", ")}
         WHERE id = $1::uuid OR slug = $1::text
         RETURNING *`,
        params,
      )
    }
    const productId = updated ? String(updated.id) : id
    if (images || variants) {
      await syncProductMedia(productId, images, variants)
    }
    if (!updated) {
      updated = await queryOne(`SELECT * FROM products WHERE id = $1::uuid OR slug = $1::text`, [id])
    }
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  try {
    const row = await queryOne<{ id: string }>(
      `SELECT id FROM products WHERE id = $1::uuid OR slug = $1::text LIMIT 1`,
      [id],
    )
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const productId = row.id

    await query(`UPDATE order_items SET variant_id = NULL WHERE product_id = $1::uuid`, [productId])
    await query(`DELETE FROM reviews WHERE product_id = $1::uuid`, [productId])
    await query(`DELETE FROM wishlists WHERE product_id = $1::uuid`, [productId])
    await query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [productId])
    await query(`DELETE FROM variants WHERE product_id = $1::uuid`, [productId])
    await query(`DELETE FROM products WHERE id = $1::uuid`, [productId])

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
