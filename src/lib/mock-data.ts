import { formatFreeShippingMinimumLabel } from "./utils"

export type { Product, ProductBadge, Variant } from "@/types/product"

export type Testimonial = {
  id: string
  name: string
  location: string
  content: string
  rating: number
  avatar: string
  product: string
}

export type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  image: string
  category: string
  date: string
  readTime: string
}

export type Occasion = {
  id: string
  name: string
  slug: string
  image: string
  description: string
}

export const occasions: Occasion[] = [
  { id: "occ-1", name: "New Arrivals", slug: "new-arrivals", image: "/mock-product.png", description: "Fresh products just added to the store" },
  { id: "occ-2", name: "Best Sellers", slug: "best-sellers", image: "/mock-product.png", description: "Customer favorites worth checking out" },
  { id: "occ-3", name: "Everyday Essentials", slug: "everyday-essentials", image: "/mock-product.png", description: "Reliable picks for daily shopping" },
  { id: "occ-4", name: "Special Offers", slug: "special-offers", image: "/mock-product.png", description: "Deals and limited-time savings" },
]

export const testimonials: Testimonial[] = [
  { id: "t-1", name: "Customer A.", location: "Verified Buyer", content: "Great selection and fast delivery. Everything arrived well packaged and as described.", rating: 5, avatar: "/images/avatars/1.jpg", product: "Online Order" },
  { id: "t-2", name: "Customer B.", location: "Verified Buyer", content: "Smooth checkout and helpful support when I had a question about my order.", rating: 5, avatar: "/images/avatars/2.jpg", product: "Online Order" },
  { id: "t-3", name: "Customer C.", location: "Verified Buyer", content: "Reliable store with quality products. I will definitely shop here again.", rating: 5, avatar: "/images/avatars/3.jpg", product: "Online Order" },
]

export const blogPosts: BlogPost[] = [
  { id: "blog-1", title: "How to Shop Online with Confidence", slug: "shop-online-with-confidence", excerpt: "Simple tips for choosing products, checking shipping details, and completing a secure checkout.", image: "/mock-product.png", category: "Guides", date: "2026-03-20", readTime: "4 min" },
  { id: "blog-2", title: "What to Know Before Your First Order", slug: "first-order-tips", excerpt: "A quick overview of delivery options, tracking, and how to contact support if you need help.", image: "/mock-product.png", category: "Guides", date: "2026-03-15", readTime: "5 min" },
  { id: "blog-3", title: "Making the Most of Store Categories", slug: "store-categories", excerpt: "Learn how to browse collections and find the products that fit what you need.", image: "/mock-product.png", category: "Shopping", date: "2026-03-10", readTime: "4 min" },
]

export const heroContent = {
  announcement: `Free delivery on orders over ${formatFreeShippingMinimumLabel()} · Quality products · Secure payments`,
  headline: "Shop With Confidence",
  subheadline: "Quality products, secure checkout, and reliable delivery — all in one place.",
  ctaPrimary: "Shop Now",
  ctaSecondary: "Explore Categories",
}
