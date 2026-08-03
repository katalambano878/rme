export type ProductBadge = "New" | "Best Seller" | "Limited" | "Sale" | "Pre-Order"

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
