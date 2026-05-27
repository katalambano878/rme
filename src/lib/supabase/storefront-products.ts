import { createClient } from "@/lib/supabase/server"
import {
  MOCK_PRODUCT_IMAGE,
  publicSupabaseProductImageUrl,
  type DbProductImageRow,
} from "@/lib/product-image"
import {
  categoryOptionLabel,
  sortCategoriesForDisplay,
} from "@/lib/category-tree"
import type {
  Product,
  ProductBadge,
  ProductVariantRow,
  Variant,
} from "@/types/product"
import { effectivePriceForVariant } from "@/lib/effective-price"

const PRODUCT_SELECT = `
  id,
  name,
  slug,
  description,
  sale_price,
  metadata,
  short_description,
  category_id,
  status,
  is_featured,
  is_new_arrival,
  is_best_seller,
  badges,
  rating_avg,
  review_count,
  delivery_estimate,
  seo_title,
  seo_description,
  created_at,
  categories ( id, name, slug ),
  product_images ( url, storage_path, sort_order, alt ),
  variants ( id, sku, price, compare_at_price, sale_price, stock_quantity, option_values )
`

type ProductRow = {
  id: string
  name: string
  slug: string
  description: string | null
  sale_price: number | string | null
  metadata: Record<string, unknown> | null
  short_description: string | null
  category_id: string | null
  is_featured: boolean
  is_new_arrival: boolean
  is_best_seller: boolean
  badges: string[] | null
  rating_avg: number | string | null
  review_count: number | null
  delivery_estimate: string | null
  seo_title: string | null
  seo_description: string | null
  created_at: string
  categories: { id: string; name: string; slug: string } | null
  product_images: DbProductImageRow[] | null
  variants: {
    id: string
    sku: string
    price: number | string
    compare_at_price: number | string | null
    sale_price: number | string | null
    stock_quantity: number | null
    option_values: { name: string; value: string }[] | null
  }[] | null
}

const BADGE_SET = new Set<ProductBadge>(["New", "Best Seller", "Limited", "Sale"])

function normalizeBadges(raw: string[] | null | undefined): ProductBadge[] {
  return (raw ?? []).filter((b): b is ProductBadge => BADGE_SET.has(b as ProductBadge))
}

function imageUrlsFromRows(images: DbProductImageRow[] | null | undefined): string[] {
  if (!images?.length) return [MOCK_PRODUCT_IMAGE]
  const sorted = [...images].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const urls = sorted
    .map((img) => {
      const u = img.url?.trim()
      if (u) return u
      const sp = img.storage_path?.trim()
      if (sp) return publicSupabaseProductImageUrl(sp)
      return null
    })
    .filter((x): x is string => Boolean(x))
  return urls.length > 0 ? urls : [MOCK_PRODUCT_IMAGE]
}

function normalizeVariantRows(row: ProductRow): ProductVariantRow[] {
  const list = row.variants ?? []
  return list.map((v) => ({
    id: v.id,
    sku: v.sku ?? "",
    price: Number(v.price) || 0,
    compare_at_price:
      v.compare_at_price != null && v.compare_at_price !== ""
        ? Number(v.compare_at_price)
        : null,
    sale_price:
      v.sale_price != null && v.sale_price !== ""
        ? Number(v.sale_price)
        : null,
    stock_quantity: v.stock_quantity ?? 0,
    option_values: Array.isArray(v.option_values) ? v.option_values : [],
  }))
}

function buildVariantGroups(variantRows: ProductVariantRow[]): Variant[] {
  const nameToValues = new Map<string, Set<string>>()
  for (const v of variantRows) {
    for (const ov of v.option_values) {
      const fieldName = (ov as any).name || (ov as any).attribute_name
      if (!fieldName || ov.value === undefined || ov.value === "") continue
      if (!nameToValues.has(fieldName)) nameToValues.set(fieldName, new Set())
      nameToValues.get(fieldName)!.add(String(ov.value))
    }
  }
  const groups: Variant[] = []
  let i = 0
  for (const [name, values] of nameToValues) {
    const lower = name.toLowerCase()
    const type: "size" | "color" =
      lower.includes("color") || lower.includes("colour") ? "color" : "size"
    groups.push({
      id: `vg-${i++}`,
      name,
      type,
      options: [...values].sort(),
    })
  }
  return groups
}

async function fetchSaleEnabled(supabase: Awaited<ReturnType<typeof getClient>>): Promise<boolean> {
  const { data } = await supabase
    .from("site_settings")
    .select("feature_flags")
    .eq("id", 1)
    .maybeSingle()
  const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {}
  return flags.sale_promotion_enabled === true
}

function cardPricing(
  variantRows: ProductVariantRow[],
  salePriceRaw: number | string | null = null,
  saleEnabled = false,
): {
  price: number
  salePrice?: number
} {
  if (variantRows.length === 0) return { price: 0 }
  // Show the cheapest variant — and use the SHARED effective-price helper so
  // the storefront UI agrees with what the payment server will actually
  // charge. (Drift between these two used to cause customers to see GH₵ 8
  // in the cart but get billed GH₵ 10 by Paystack/Moolre.)
  const sorted = [...variantRows].sort((a, b) => a.price - b.price)
  const v = sorted[0]
  const pricing = effectivePriceForVariant(v, { sale_price: salePriceRaw }, saleEnabled)
  return pricing.onSale
    ? { price: pricing.original, salePrice: pricing.effective }
    : { price: pricing.effective }
}

function totalStock(variantRows: ProductVariantRow[]): number {
  return variantRows.reduce((s, v) => s + (v.stock_quantity ?? 0), 0)
}

export function mapProductRowToProduct(row: ProductRow, saleEnabled = false): Product {
  const variantRows = normalizeVariantRows(row)
  const { price, salePrice } = cardPricing(variantRows, row.sale_price, saleEnabled)
  const cat = row.categories

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description?.trim() ?? "",
    shortDescription: row.short_description?.trim() ?? row.name,
    categoryId: row.category_id ?? cat?.id ?? "",
    categoryName: cat?.name ?? "",
    categorySlug: (cat?.slug ?? "").toLowerCase(),
    price,
    salePrice,
    images: imageUrlsFromRows(row.product_images ?? undefined),
    badges: (() => {
      const b = normalizeBadges(row.badges)
      if (salePrice !== undefined && !b.includes("Sale")) b.unshift("Sale")
      return b
    })(),
    variants: buildVariantGroups(variantRows),
    stock: totalStock(variantRows),
    rating: Number(row.rating_avg) || 0,
    reviewCount: row.review_count ?? 0,
    sku: variantRows[0]?.sku ?? "",
    isFeatured: row.is_featured ?? false,
    isNewArrival: row.is_new_arrival ?? false,
    isBestSeller: row.is_best_seller ?? false,
    deliveryEstimate: row.delivery_estimate?.trim() || "1–2 business days",
    createdAt: row.created_at,
    seoTitle: row.seo_title?.trim() || undefined,
    seoDescription: row.seo_description?.trim() || undefined,
  }
}

export function extractVariantRows(row: ProductRow): ProductVariantRow[] {
  return normalizeVariantRows(row)
}

async function getClient() {
  return createClient()
}

export async function fetchStorefrontProductBySlug(
  slug: string,
): Promise<{ product: Product; variantRows: ProductVariantRow[] } | null> {
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).eq("status", "active").maybeSingle(),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data) return null
  const row = data as unknown as ProductRow
  return {
    product: mapProductRowToProduct(row, saleEnabled),
    variantRows: extractVariantRows(row),
  }
}

export async function fetchRelatedProducts(
  categoryId: string | null,
  excludeProductId: string,
  limit = 4,
): Promise<Product[]> {
  if (!categoryId) return []
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").eq("category_id", categoryId).neq("id", excludeProductId).order("created_at", { ascending: false }).limit(limit),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data) return []
  return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchActiveProducts(): Promise<Product[]> {
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").order("created_at", { ascending: false }),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data) return []
  return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchNewArrivals(limit: number): Promise<Product[]> {
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").eq("is_new_arrival", true).order("created_at", { ascending: false }).limit(limit),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data?.length) {
    const { data: fb } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").order("created_at", { ascending: false }).limit(limit)
    if (!fb) return []
    return (fb as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
  }
  return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchBestSellers(limit: number): Promise<Product[]> {
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").eq("is_best_seller", true).order("review_count", { ascending: false }).limit(limit),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data?.length) {
    const { data: fb } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").order("review_count", { ascending: false }).limit(limit)
    if (!fb) return []
    return (fb as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
  }
  return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchTrendingProducts(limit: number): Promise<Product[]> {
  const supabase = await getClient()
  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").eq("is_featured", true).order("created_at", { ascending: false }).limit(limit),
    fetchSaleEnabled(supabase),
  ])

  if (!error && data?.length) {
    return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
  }

  const { data: fb } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").order("review_count", { ascending: false }).limit(limit)
  return (fb as unknown as ProductRow[] | null)?.map((r) => mapProductRowToProduct(r, saleEnabled)) ?? []
}

export async function fetchProductsByCategorySlug(
  categorySlug: string,
  limit: number,
): Promise<Product[]> {
  const supabase = await getClient()
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle()

  if (!cat?.id) return []

  const [{ data, error }, saleEnabled] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").eq("category_id", cat.id).order("created_at", { ascending: false }).limit(limit),
    fetchSaleEnabled(supabase),
  ])

  if (error || !data) return []
  return (data as unknown as ProductRow[]).map((r) => mapProductRowToProduct(r, saleEnabled))
}

export type StorefrontCategory = {
  id: string
  name: string
  /** Tree label for filters/UI (e.g. "↳ Body lotion" under a parent). */
  displayName: string
  slug: string
  description: string
  productCount: number
  image_url: string | null
}

export async function fetchHomepageCategoryLimit(): Promise<number | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from("home_content")
    .select("sections")
    .eq("id", 1)
    .maybeSingle()

  if (error) return null
  const sections = data?.sections
  if (!Array.isArray(sections)) return null

  for (const section of sections) {
    if (!section || typeof section !== "object") continue
    const candidate = section as Record<string, unknown>
    const sectionType = String(
      candidate.type ?? candidate.id ?? candidate.key ?? "",
    ).toLowerCase()
    if (!sectionType.includes("categor")) continue

    const rawLimit =
      candidate.limit ??
      candidate.count ??
      candidate.items ??
      candidate.max ??
      candidate.perPage

    const parsed =
      typeof rawLimit === "number"
        ? rawLimit
        : Number.parseInt(String(rawLimit ?? ""), 10)

    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

export async function fetchStorefrontCategoriesWithCounts(): Promise<
  StorefrontCategory[]
> {
  const supabase = await getClient()
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_url, parent_id, sort_order")
    .eq("is_active", true)

  if (catErr || !cats?.length) return []

  const { data: products } = await supabase
    .from("products")
    .select("category_id")
    .eq("status", "active")

  const countMap = new Map<string, number>()
  for (const p of products ?? []) {
    const cid = p.category_id as string | null
    if (!cid) continue
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1)
  }

  type CatRow = {
    id: string
    name: string | null
    slug: string | null
    description: string | null
    image_url: string | null
    parent_id: string | null
    sort_order: number | null
  }
  const rows = cats as CatRow[]
  const sorted = sortCategoriesForDisplay(rows)
  const byId = new Map(sorted.map((c) => [c.id, c]))

  return sorted.map((c) => {
    const name = c.name ?? ""
    return {
      id: c.id,
      name,
      displayName: categoryOptionLabel(c, byId),
      slug: (c.slug ?? "").toLowerCase(),
      description: (c.description as string | null)?.trim() ?? "",
      productCount: countMap.get(c.id) ?? 0,
      image_url: (c.image_url as string | null)?.trim() || null,
    }
  })
}
