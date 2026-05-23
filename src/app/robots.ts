import type { MetadataRoute } from "next"
import { SITE_DOMAIN } from "@/lib/brand"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = `https://${SITE_DOMAIN}`

  // SECURITY: Vercel preview / branch deploys must never show up in Google.
  // If the request is being served from a non-canonical host (preview URL)
  // tell crawlers to avoid the entire site.
  const vercelEnv = process.env.VERCEL_ENV
  const isPreview = vercelEnv && vercelEnv !== "production"

  if (isPreview) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/superadmin/",
          "/api/",
          "/checkout/",
          "/account/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
