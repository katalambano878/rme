import type { Metadata } from "next"
import { BRAND_NAME, BRAND_TAGLINE, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "About Us",
  description: `Learn about ${BRAND_NAME} — a trusted online store offering quality products and a secure shopping experience. ${BRAND_TAGLINE}`,
  keywords: [
    `about ${BRAND_NAME}`,
    "online store",
    "ecommerce",
    "Trust Ecom",
  ],
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    title: `About ${BRAND_NAME}`,
    description: `Learn about ${BRAND_NAME} — your trusted online store for quality products and secure shopping.`,
    url: `${siteUrl}/about`,
    type: "website",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
