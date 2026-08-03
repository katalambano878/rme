import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "All Collections",
  description: `Explore all product collections at ${BRAND_NAME}. Shop by category to find what you need.`,
  keywords: [
    "product collections",
    "shop by category",
    "online store",
    `${BRAND_NAME} collections`,
  ],
  alternates: {
    canonical: `${siteUrl}/collections`,
  },
  openGraph: {
    title: `Collections | ${BRAND_NAME}`,
    description: `Browse all ${BRAND_NAME} product collections — organized by category for easy shopping.`,
    url: `${siteUrl}/collections`,
    type: "website",
  },
}

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
