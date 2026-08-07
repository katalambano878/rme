/** Single mock asset used when a product has no images (and for category fallbacks). */
export const MOCK_PRODUCT_IMAGE = "/mock-product.png"

const SAME_ORIGIN_HOSTS = new Set([
  "ronnyandme.com",
  "www.ronnyandme.com",
  "localhost",
  "127.0.0.1",
])

/** Rewrite absolute storage URLs to same-origin paths (avoids www↔apex CSP blocks). */
export function normalizePublicImageSrc(src: string): string {
  const trimmed = src.trim()
  if (!trimmed) return trimmed
  try {
    if (trimmed.startsWith("/")) return trimmed
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase()
    const isStoragePath = u.pathname.startsWith("/storage/v1/object/public/")
    if (
      isStoragePath &&
      (host.endsWith(".supabase.co") ||
        SAME_ORIGIN_HOSTS.has(host) ||
        host.endsWith(".sslip.io"))
    ) {
      return u.pathname + u.search
    }
  } catch {
    /* keep as-is */
  }
  return trimmed
}

export function optimizedImageUrl(src: string, width?: number): string {
  const normalized = normalizePublicImageSrc(src)
  if (!normalized) return MOCK_PRODUCT_IMAGE
  if (
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("http://localhost") ||
    normalized.startsWith("http://127.0.0.1")
  ) {
    return normalized
  }
  return `/api/img?src=${encodeURIComponent(normalized)}&w=${width || 640}`
}

/** Admin/list thumbnails — same proxy as storefront; safe for null/empty. */
export function adminImageSrc(
  src: string | null | undefined,
  width = 200,
): string {
  if (!src?.trim()) return MOCK_PRODUCT_IMAGE
  return optimizedImageUrl(src, width)
}

export function getProductGalleryImages(product: {
  images?: string[] | null
}): string[] {
  const list = (product.images ?? [])
    .map((s) => (typeof s === "string" ? normalizePublicImageSrc(s.trim()) : ""))
    .filter(Boolean)
  return list.length > 0 ? list : [MOCK_PRODUCT_IMAGE]
}

export function getProductPrimaryImageUrl(product: {
  images?: string[] | null
}): string {
  return getProductGalleryImages(product)[0]
}

export type DbProductImageRow = {
  url: string | null
  storage_path: string | null
  sort_order: number | null
}

/** Public URL for a file in the `product-images` bucket (server or client). */
export function publicSupabaseProductImageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? ""
  const path = storagePath.replace(/^\//, "")
  if (!base || !path) return MOCK_PRODUCT_IMAGE
  return `${base}/storage/v1/object/public/product-images/${path}`
}

/** Pick primary image from Supabase `product_images` rows (sorted by `sort_order`). */
export function primaryImageFromDbRows(
  images: DbProductImageRow[] | null | undefined,
): string {
  if (!images?.length) return MOCK_PRODUCT_IMAGE
  const sorted = [...images].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const first = sorted[0]
  const u = first.url?.trim()
  if (u) return u
  const sp = first.storage_path?.trim()
  if (sp) return publicSupabaseProductImageUrl(sp)
  return MOCK_PRODUCT_IMAGE
}
