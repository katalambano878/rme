import { query, queryOne } from "@/lib/db"
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

const PRODUCT_SELECT_SQL = `
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.sale_price,
  p.metadata,
  p.short_description,
  p.category_id,
  p.status,
  p.is_featured,
  p.is_new_arrival,
  p.is_best_seller,
  p.badges,
  p.rating_avg,
  p.review_count,
  p.delivery_estimate,
  p.seo_title,
  p.seo_description,
  p.created_at,
  CASE
    WHEN c.id IS NOT NULL THEN jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'slug', c.slug
    )
    ELSE NULL
  END AS categories,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', pi.url,
          'storage_path', pi.storage_path,
          'sort_order', pi.sort_order,
          'alt', pi.alt
        )
      )
      FROM product_images pi
      WHERE pi.product_id = p.id
    ),
    '[]'::jsonb
  ) AS product_images,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'sku', v.sku,
          'price', v.price,
          'compare_at_price', v.compare_at_price,
          'sale_price', v.sale_price,
          'stock_quantity', v.stock_quantity,
          'option_values', v.option_values
        )
      )
      FROM variants v
      WHERE v.product_id = p.id
    ),
    '[]'::jsonb
  ) AS variants
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
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

const BADGE_SET = new Set<ProductBadge>(["New", "Best Seller", "Limited", "Sale", "Pre-Order"])

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

async function fetchSaleEnabled(): Promise<boolean> {
  const row = await queryOne<{ feature_flags: Record<string, unknown> | null }>(
    `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
  )
  const flags = row?.feature_flags ?? {}
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

function parseProductRow(row: ProductRow): ProductRow {
  const images = row.product_images
  const variants = row.variants
  return {
    ...row,
    product_images: Array.isArray(images) ? images : images ? [images as unknown as DbProductImageRow] : [],
    variants: Array.isArray(variants) ? variants : variants ? [variants as unknown as NonNullable<ProductRow["variants"]>[number]] : [],
  }
}

async function fetchProductRows(
  extraWhere: string,
  params: unknown[],
  orderBy: string,
  limit?: number,
): Promise<ProductRow[]> {
  const limitSql = limit != null ? ` LIMIT $${params.length + 1}` : ""
  const allParams = limit != null ? [...params, limit] : params
  const { rows } = await query<ProductRow>(
    `${PRODUCT_SELECT_SQL}
     WHERE p.status = 'active' AND ${extraWhere}
     ORDER BY ${orderBy}${limitSql}`,
    allParams,
  )
  return rows.map(parseProductRow)
}

async function fetchProductRowOne(
  extraWhere: string,
  params: unknown[],
): Promise<ProductRow | null> {
  const row = await queryOne<ProductRow>(
    `${PRODUCT_SELECT_SQL}
     WHERE p.status = 'active' AND ${extraWhere}
     LIMIT 1`,
    params,
  )
  return row ? parseProductRow(row) : null
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

export async function fetchStorefrontProductBySlug(
  slug: string,
): Promise<{ product: Product; variantRows: ProductVariantRow[] } | null> {
  const [row, saleEnabled] = await Promise.all([
    fetchProductRowOne("p.slug = $1", [slug]),
    fetchSaleEnabled(),
  ])

  if (!row) return null
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
  const [rows, saleEnabled] = await Promise.all([
    fetchProductRows("p.category_id = $1 AND p.id <> $2", [categoryId, excludeProductId], "p.created_at DESC", limit),
    fetchSaleEnabled(),
  ])
  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchActiveProducts(): Promise<Product[]> {
  const [rows, saleEnabled] = await Promise.all([
    fetchProductRows("TRUE", [], "p.created_at DESC"),
    fetchSaleEnabled(),
  ])
  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchNewArrivals(limit: number): Promise<Product[]> {
  const saleEnabled = await fetchSaleEnabled()
  let rows = await fetchProductRows(
    "p.is_new_arrival = true",
    [],
    "p.created_at DESC",
    limit,
  )

  if (rows.length === 0) {
    rows = await fetchProductRows("TRUE", [], "p.created_at DESC", limit)
  }

  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchBestSellers(limit: number): Promise<Product[]> {
  const saleEnabled = await fetchSaleEnabled()
  let rows = await fetchProductRows(
    "p.is_best_seller = true",
    [],
    "p.review_count DESC",
    limit,
  )

  if (rows.length === 0) {
    rows = await fetchProductRows("TRUE", [], "p.review_count DESC", limit)
  }

  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchTrendingProducts(limit: number): Promise<Product[]> {
  const saleEnabled = await fetchSaleEnabled()
  let rows = await fetchProductRows(
    "p.is_featured = true",
    [],
    "p.created_at DESC",
    limit,
  )

  if (rows.length === 0) {
    rows = await fetchProductRows("TRUE", [], "p.review_count DESC", limit)
  }

  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
}

export async function fetchProductsByCategorySlug(
  categorySlug: string,
  limit: number,
): Promise<Product[]> {
  const cat = await queryOne<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1 AND is_active = true LIMIT 1`,
    [categorySlug],
  )

  if (!cat?.id) return []

  const [rows, saleEnabled] = await Promise.all([
    fetchProductRows("p.category_id = $1", [cat.id], "p.created_at DESC", limit),
    fetchSaleEnabled(),
  ])
  return rows.map((r) => mapProductRowToProduct(r, saleEnabled))
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
  const row = await queryOne<{ sections: unknown }>(
    `SELECT sections FROM home_content WHERE id = 1 LIMIT 1`,
  )

  const sections = row?.sections
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
  const [cats, productRows] = await Promise.all([
    query<{
      id: string
      name: string | null
      slug: string | null
      description: string | null
      image_url: string | null
      parent_id: string | null
      sort_order: number | null
    }>(
      `SELECT id, name, slug, description, image_url, parent_id, sort_order
       FROM categories
       WHERE is_active = true`,
    ),
    query<{ category_id: string | null }>(
      `SELECT category_id FROM products WHERE status = 'active'`,
    ),
  ])

  if (!cats.rows.length) return []

  const countMap = new Map<string, number>()
  for (const p of productRows.rows) {
    const cid = p.category_id
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
  const rows = cats.rows as CatRow[]
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
