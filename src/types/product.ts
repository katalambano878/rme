export type ProductBadge = "New" | "Best Seller" | "Limited" | "Sale"

export type Variant = {
  id: string
  name: string
  type: "size" | "color"
  options: string[]
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  shortDescription: string
  categoryId: string
  categoryName: string
  categorySlug: string
  price: number
  salePrice?: number
  /** Raw `products.sale_price` — used with variant rows for consistent sale pricing. */
  catalogSalePrice?: number | null
  /** Whether global sale promotion was enabled when this product was loaded. */
  salePromotionEnabled?: boolean
  images: string[]
  badges: ProductBadge[]
  variants: Variant[]
  stock: number
  rating: number
  reviewCount: number
  sku: string
  isFeatured: boolean
  isNewArrival: boolean
  isBestSeller: boolean
  deliveryEstimate: string
  createdAt: string
  seoTitle?: string
  seoDescription?: string
}

export type ProductVariantRow = {
  id: string
  sku: string
  price: number
  compare_at_price: number | null
  sale_price: number | null
  stock_quantity: number
  option_values: { name: string; value: string }[]
}
