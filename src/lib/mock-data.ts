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
  { id: "occ-1", name: "Morning Routine", slug: "morning-routine", image: "/mock-product.png", description: "Cleanse, hydrate, and protect for the day" },
  { id: "occ-2", name: "Night Repair", slug: "night-repair", image: "/mock-product.png", description: "Recovery-focused products for overnight care" },
  { id: "occ-3", name: "Body Care", slug: "body-care", image: "/mock-product.png", description: "Smooth, nourish, and refresh from head to toe" },
  { id: "occ-4", name: "Lip Care", slug: "lip-care", image: "/mock-product.png", description: "Scrub, hydrate, and gloss for soft lips" },
]

export const testimonials: Testimonial[] = [
  { id: "t-1", name: "Customer A.", location: "Accra", content: "My skin texture improved so much after two weeks. The products are authentic and delivery was very fast.", rating: 5, avatar: "/images/avatars/1.jpg", product: "Advanced Korean Skin Face Cream" },
  { id: "t-2", name: "Customer B.", location: "East Legon", content: "The lip scrub and gloss combo is now part of my daily routine. My lips stay soft all day.", rating: 5, avatar: "/images/avatars/2.jpg", product: "Sugar Lip Scrub" },
  { id: "t-3", name: "Customer C.", location: "Spintex", content: "I love that I can find skincare, body lotion, and makeup in one place. Great service and quality.", rating: 5, avatar: "/images/avatars/3.jpg", product: "Aqua Rich Body Lotion" },
  { id: "t-4", name: "Customer D.", location: "Tema", content: "The products arrived well packaged and exactly as shown. Definitely ordering again.", rating: 5, avatar: "/images/avatars/4.jpg", product: "Ushas Setting Spray" },
  { id: "t-5", name: "Customer E.", location: "Airport", content: "Customer support helped me choose the right products for my skin and the results have been amazing.", rating: 5, avatar: "/images/avatars/5.jpg", product: "Skincare Set" },
]

export const blogPosts: BlogPost[] = [
  { id: "blog-1", title: "How to Build a Simple Morning Skincare Routine", slug: "morning-skincare-routine", excerpt: "A practical step-by-step routine to cleanse, hydrate, and protect your skin every morning.", image: "/mock-product.png", category: "Skincare", date: "2026-03-20", readTime: "4 min" },
  { id: "blog-2", title: "Lip Care 101: Scrub, Hydrate, and Gloss", slug: "lip-care-101", excerpt: "Learn how to keep your lips smooth and healthy using a simple weekly lip care routine.", image: "/mock-product.png", category: "Lip Care", date: "2026-03-15", readTime: "5 min" },
  { id: "blog-3", title: "Body Care Essentials for Soft, Healthy Skin", slug: "body-care-essentials", excerpt: "From body wash to lotion, here is how to choose products that keep your skin nourished.", image: "/mock-product.png", category: "Body Care", date: "2026-03-10", readTime: "4 min" },
]

export const heroContent = {
  announcement: `Free delivery on orders over ${formatFreeShippingMinimumLabel()} · Authentic products · Secure payments`,
  headline: "Glow Starts With Healthy Skin",
  subheadline: "Skincare, lip care, body care, makeup, hair essentials, and baby products for everyday confidence.",
  ctaPrimary: "Shop Best Sellers",
  ctaSecondary: "Explore Categories",
}
