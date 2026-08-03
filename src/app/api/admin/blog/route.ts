import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export const runtime = "nodejs"

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const published = searchParams.get("published")

  try {
    const params: unknown[] = []
    let where = ""
    if (published === "true") {
      where = "WHERE published = true"
    } else if (published === "false") {
      where = "WHERE published = false"
    }

    const result = await query(
      `SELECT id, title, slug, excerpt, body, cover_image_url, category,
              published, published_at, read_time_minutes, created_at, updated_at
       FROM blog_posts
       ${where}
       ORDER BY coalesce(published_at, updated_at, created_at) DESC`,
      params,
    )
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error("[admin/blog GET]", err)
    return NextResponse.json({ error: "Failed to list posts" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true })
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const title = String(body.title || "").trim()
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    const postBody = String(body.body ?? body.content ?? "").trim()
    if (!postBody) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    let slug = String(body.slug || slugify(title)).trim()
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 })
    }

    const existing = await queryOne(`SELECT id FROM blog_posts WHERE slug = $1`, [slug])
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const published = Boolean(body.published)
    const publishedAt = published ? body.published_at || new Date().toISOString() : null

    const created = await queryOne(
      `INSERT INTO blog_posts (
         title, slug, excerpt, body, cover_image_url, category,
         published, published_at, read_time_minutes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9
       ) RETURNING *`,
      [
        title,
        slug,
        body.excerpt || null,
        postBody,
        body.cover_image_url || body.featured_image || null,
        body.category || null,
        published,
        publishedAt,
        body.read_time_minutes ?? null,
      ],
    )

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    console.error("[admin/blog POST]", err)
    const message = err instanceof Error ? err.message : "Create failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
