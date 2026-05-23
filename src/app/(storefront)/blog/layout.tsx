import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Beauty Journal",
  description: `Beauty tips, skincare guides, and self-care inspiration from ${BRAND_NAME}. Explore routines, ingredient breakdowns, and product advice for everyday glow.`,
  keywords: [
    "beauty tips Ghana",
    "skincare guide",
    "lip care tips",
    "beauty blog Ghana",
    "skincare routine",
    "self care Ghana",
    `${BRAND_NAME} blog`,
  ],
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
  openGraph: {
    title: `Beauty Journal | ${BRAND_NAME}`,
    description: `Beauty tips, skincare guides, and self-care inspiration from ${BRAND_NAME}.`,
    url: `${siteUrl}/blog`,
    type: "website",
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
