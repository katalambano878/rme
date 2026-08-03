import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN, CONTACT_EMAIL } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${BRAND_NAME}. Reach us by email for orders, returns, and general inquiries.`,
  keywords: [
    `contact ${BRAND_NAME}`,
    "online store contact",
    "ecommerce support",
    CONTACT_EMAIL,
  ],
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    title: `Contact ${BRAND_NAME}`,
    description: `We'd love to hear from you. Reach ${BRAND_NAME} for orders, returns, and support.`,
    url: `${siteUrl}/contact`,
    type: "website",
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
