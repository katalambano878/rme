import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "About Us",
  description: `Learn the story behind ${BRAND_NAME} — born from a passion for beauty and skincare, bringing trusted beauty products to Ghana. Quality skincare, lip care, body care, makeup, and more.`,
  keywords: [
    `about ${BRAND_NAME}`,
    "Ghana beauty brand",
    "online beauty store Ghana",
    "skincare brand Ghana",
    "RonnyandMe story",
  ],
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    title: `About ${BRAND_NAME} — Our Story`,
    description: `Where beauty meets everyday care. Learn about ${BRAND_NAME} — your trusted source for premium beauty products in Ghana.`,
    url: `${siteUrl}/about`,
    type: "website",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
