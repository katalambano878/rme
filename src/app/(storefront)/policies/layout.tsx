import type { Metadata } from "next"
import { BRAND_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: { absolute: `Policies | ${BRAND_NAME}` },
  description: `${BRAND_NAME} store policies — shipping, returns, privacy, and terms of service. Everything you need to know about shopping with us.`,
}

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
