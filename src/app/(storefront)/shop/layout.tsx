import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Shop All Products",
  description: `Browse all beauty products at ${BRAND_NAME} — skincare, lip glosses, lip scrubs, lip oils, body lotions, makeup, hair products, and baby essentials. Filter by category and find your perfect match.`,
  keywords: [
    "shop beauty products Ghana",
    "buy skincare Ghana",
    "lip gloss shop",
    "body lotion Ghana",
    "makeup online Ghana",
    "all beauty products",
    `${BRAND_NAME} shop`,
  ],
  alternates: {
    canonical: `${siteUrl}/shop`,
  },
  openGraph: {
    title: `Shop All Products | ${BRAND_NAME}`,
    description: `Browse our full collection of beauty and skincare products. Skincare, lip care, body care, makeup, and more — delivered in Ghana.`,
    url: `${siteUrl}/shop`,
    type: "website",
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
