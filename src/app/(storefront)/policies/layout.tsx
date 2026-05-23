import type { Metadata } from "next"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: {
    template: `%s Policy | ${BRAND_NAME}`,
    default: `Policies | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} store policies — shipping, returns, privacy, and terms of service. Everything you need to know about shopping with us.`,
  alternates: {
    canonical: `${siteUrl}/policies`,
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
