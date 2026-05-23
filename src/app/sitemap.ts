import type { MetadataRoute } from "next"
import { SITE_DOMAIN } from "@/lib/brand"

export const dynamic = "force-dynamic"

const BASE = `https://${SITE_DOMAIN}`

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

async function querySupabase<T>(table: string, select: string, filters: string = ""): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/collections`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/policies/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/shipping`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/returns`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ]

  try {
    const [products, categories] = await Promise.all([
      querySupabase<{ slug: string; updated_at: string }>(
        "products",
        "slug,updated_at",
        "&status=eq.active",
      ),
      querySupabase<{ slug: string }>(
        "categories",
        "slug",
        "&is_active=eq.true",
      ),
    ])

    const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${BASE}/products/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${BASE}/shop?category=${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

    return [...staticRoutes, ...productRoutes, ...categoryRoutes]
  } catch {
    return staticRoutes
  }
}
