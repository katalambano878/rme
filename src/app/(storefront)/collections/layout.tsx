import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "All Collections",
  description: `Explore all beauty collections at ${BRAND_NAME} — Skincare, Lip Care, Body Care, Makeup, Hair Products, Baby Products, and more. Shop by category to find what works for you.`,
  keywords: [
    "beauty collections Ghana",
    "skincare collection",
    "lip care collection",
    "body care Ghana",
    "makeup collection Ghana",
    `${BRAND_NAME} collections`,
  ],
  alternates: {
    canonical: `${siteUrl}/collections`,
  },
  openGraph: {
    title: `Collections | ${BRAND_NAME}`,
    description: `Browse all ${BRAND_NAME} beauty collections — curated skincare, lip care, makeup, body care, and more.`,
    url: `${siteUrl}/collections`,
    type: "website",
  },
}

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
