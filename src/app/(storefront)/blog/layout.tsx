import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Blog",
  description: `Tips, guides, and updates from ${BRAND_NAME}. Explore product advice, shopping tips, and store news.`,
  keywords: [
    "shopping tips",
    "product guides",
    "online store blog",
    `${BRAND_NAME} blog`,
  ],
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
  openGraph: {
    title: `Blog | ${BRAND_NAME}`,
    description: `Tips, guides, and updates from ${BRAND_NAME}.`,
    url: `${siteUrl}/blog`,
    type: "website",
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
