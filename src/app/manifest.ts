import type { MetadataRoute } from "next"
import { BRAND_NAME, BRAND_LEGAL_NAME, BRAND_TAGLINE } from "@/lib/brand"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_LEGAL_NAME,
    short_name: BRAND_NAME,
    description: `${BRAND_NAME} — Beauty & Skincare Essentials. ${BRAND_TAGLINE}`,
    start_url: "/",
    display: "standalone",
    background_color: "#fff0f3",
    theme_color: "#e8637e",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["shopping", "beauty", "lifestyle"],
    lang: "en",
    dir: "ltr",
  }
}
