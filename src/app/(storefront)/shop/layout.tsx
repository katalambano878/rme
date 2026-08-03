import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Shop All Products",
  description: `Browse all products at ${BRAND_NAME}. Filter by category and find what you need with secure checkout and reliable delivery.`,
  keywords: [
    "shop online",
    "ecommerce",
    "online store",
    `${BRAND_NAME} shop`,
  ],
  alternates: {
    canonical: `${siteUrl}/shop`,
  },
  openGraph: {
    title: `Shop All Products | ${BRAND_NAME}`,
    description: `Browse our full product collection at ${BRAND_NAME}. Quality products with secure checkout.`,
    url: `${siteUrl}/shop`,
    type: "website",
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
