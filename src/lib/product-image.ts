/** Single mock asset used when a product has no images (and for category fallbacks). */
export const MOCK_PRODUCT_IMAGE = "/mock-product.png"

/** Rewrite legacy hosted Supabase public URLs to same-origin storage paths. */
export function normalizePublicImageSrc(src: string): string {
  const trimmed = src.trim()
  if (!trimmed) return trimmed
  try {
    if (trimmed.startsWith("/")) return trimmed
    const u = new URL(trimmed)
    if (
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.startsWith("/storage/v1/object/public/")
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
  return `/api/img?src=${encodeURIComponent(normalized)}&w=${width || 640}`
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
