import { query, queryOne } from "@/lib/db"

export type StorefrontOccasion = {
  id: string
  name: string
  slug: string
  image: string
  description: string
}

export type StorefrontTestimonial = {
  id: string
  name: string
  location: string
  content: string
  rating: number
  avatar: string
  product: string
}

export type StorefrontBlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  cover_image_url: string | null
  content: string | null
  published_at: string | null
  created_at: string
}

export async function fetchStorefrontAnnouncement(): Promise<string | null> {
  try {
    const row = await queryOne<{ announcement_bar: string | null }>(
      `SELECT announcement_bar FROM storefront_settings WHERE id = 1 LIMIT 1`,
    )
    return row?.announcement_bar ?? null
  } catch {
    return null
  }
}

export async function fetchActiveOccasions(): Promise<StorefrontOccasion[]> {
  try {
    const { rows } = await query<StorefrontOccasion>(
      `SELECT id, name, slug, image, description
       FROM occasions
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    )
    return rows
  } catch {
    return []
  }
}

export async function fetchActiveTestimonials(limit = 6): Promise<StorefrontTestimonial[]> {
  try {
    const { rows } = await query<StorefrontTestimonial>(
      `SELECT id, name, location, content, rating, avatar, product
       FROM testimonials
       WHERE is_active = true
       ORDER BY sort_order ASC
       LIMIT $1`,
      [limit],
    )
    return rows
  } catch {
    return []
  }
}

export async function fetchPublishedBlogPostBySlug(
  slug: string,
): Promise<StorefrontBlogPost | null> {
  try {
    return queryOne<StorefrontBlogPost>(
      `SELECT
         id,
         title,
         slug,
         COALESCE(excerpt, '') AS excerpt,
         COALESCE(category, '') AS category,
         cover_image_url,
         body AS content,
         published_at,
         created_at
       FROM blog_posts
       WHERE slug = $1 AND published = true
       LIMIT 1`,
      [slug],
    )
  } catch {
    return null
  }
}

export async function fetchRelatedBlogPosts(
  excludeSlug: string,
  limit = 2,
): Promise<StorefrontBlogPost[]> {
  try {
    const { rows } = await query<StorefrontBlogPost>(
      `SELECT
         id,
         title,
         slug,
         COALESCE(excerpt, '') AS excerpt,
         COALESCE(category, '') AS category,
         cover_image_url,
         published_at,
         created_at,
         NULL::text AS content
       FROM blog_posts
       WHERE published = true AND slug <> $1
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $2`,
      [excludeSlug, limit],
    )
    return rows
  } catch {
    return []
  }
}
