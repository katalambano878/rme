import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = new URL(request.url).searchParams.get("status") || "all"

  try {
    const result =
      status === "all"
        ? await query(
            `SELECT r.*,
              p.name AS product_name,
              pr.full_name AS reviewer_name,
              pr.email AS reviewer_email,
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object('url', pi.url) ORDER BY pi.sort_order)
                 FROM product_images pi WHERE pi.product_id = p.id LIMIT 1),
                '[]'::jsonb
              ) AS product_images
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             LEFT JOIN profiles pr ON pr.id = r.user_id
             ORDER BY r.created_at DESC`,
          )
        : await query(
            `SELECT r.*,
              p.name AS product_name,
              pr.full_name AS reviewer_name,
              pr.email AS reviewer_email,
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object('url', pi.url) ORDER BY pi.sort_order)
                 FROM product_images pi WHERE pi.product_id = p.id LIMIT 1),
                '[]'::jsonb
              ) AS product_images
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             LEFT JOIN profiles pr ON pr.id = r.user_id
             WHERE r.is_published = $1
             ORDER BY r.created_at DESC`,
            [status === "approved"],
          )

    return NextResponse.json(result.rows)
  } catch (err: unknown) {
    console.error("[admin/reviews GET]", err)
    return NextResponse.json({ error: "Failed to list reviews" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { id, status, is_published } = body
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  let published = is_published
  if (typeof status === "string") {
    published = status.toLowerCase() === "approved"
  }

  const updated = await queryOne(
    `UPDATE reviews SET is_published = $2 WHERE id = $1::uuid RETURNING *`,
    [id, Boolean(published)],
  )
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(updated)
}
