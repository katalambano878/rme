import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN, PHONE_INTERNATIONAL_PRIMARY, CONTACT_EMAIL } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${BRAND_NAME}. Reach us by WhatsApp, phone, or email for orders, returns, and beauty advice. Located in Accra, Ghana.`,
  keywords: [
    `contact ${BRAND_NAME}`,
    "RonnyandMe WhatsApp",
    "beauty store Accra",
    "Ghana beauty contact",
    PHONE_INTERNATIONAL_PRIMARY,
    CONTACT_EMAIL,
  ],
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    title: `Contact ${BRAND_NAME}`,
    description: `We'd love to hear from you. Reach ${BRAND_NAME} by WhatsApp, phone, or email for orders and beauty advice.`,
    url: `${siteUrl}/contact`,
    type: "website",
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
