import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },

  async rewrites() {
    return [{ source: '/service-worker.js', destination: '/api/service-worker' }]
  },

  async headers() {
    // SECURITY: Vercel preview / branch deploys must never be indexed.
    const isPreview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"
    const previewHeader = isPreview
      ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
      : []

    return [
      {
        source: "/(.*)",
        headers: [
          ...previewHeader,
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com",
              "connect-src 'self' https://api.groq.com https://api.moolre.com https://api.paystack.co",
              "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com https://js.paystack.co",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Long-lived cache for static brand assets
        source: "/brand/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Long-lived cache for category/product images
        source: "/categories/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Long-lived cache for general static images
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default nextConfig
