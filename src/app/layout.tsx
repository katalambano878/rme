import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import {
  BRAND_LOGO_ALT,
  BRAND_LOGO_SRC,
  BRAND_NAME,
  BRAND_LEGAL_NAME,
  BRAND_TAGLINE,
  SITE_DOMAIN,
  CONTACT_EMAIL,
  PHONE_INTERNATIONAL_PRIMARY,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  TIKTOK_URL,
  WHATSAPP_URL,
} from "@/lib/brand"
import ChatWidget from "@/components/ChatWidget"

function getSiteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    try {
      return new URL(fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`)
    } catch {
      /* use fallbacks below */
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`)
  }
  return new URL(`https://${SITE_DOMAIN}`)
}

const siteUrl = `https://${SITE_DOMAIN}`

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
})

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: `${BRAND_NAME} — Beauty & Skincare Essentials`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} (${BRAND_LEGAL_NAME}) — premium skincare, lip care, body lotion, makeup, hair products, and baby essentials in Ghana. ${BRAND_TAGLINE}`,
  keywords: [
    BRAND_NAME,
    BRAND_LEGAL_NAME,
    "beauty products Ghana",
    "skincare Ghana",
    "lip gloss Ghana",
    "lip care",
    "body lotion Ghana",
    "makeup Ghana",
    "hair products Ghana",
    "baby products Ghana",
    "online beauty store Ghana",
    "lip scrub",
    "lip oil",
    "setting spray",
    "Accra beauty",
    "Ghana cosmetics",
  ],
  authors: [{ name: BRAND_LEGAL_NAME, url: siteUrl }],
  creator: BRAND_LEGAL_NAME,
  publisher: BRAND_LEGAL_NAME,
  category: "shopping",
  classification: "Beauty & Personal Care",
  applicationName: BRAND_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: `${BRAND_NAME} — Beauty & Skincare Essentials`,
    description: `Shop ${BRAND_NAME} — premium beauty products in Ghana. Skincare, lip care, body care, makeup, and more. ${BRAND_TAGLINE}`,
    siteName: BRAND_NAME,
    url: siteUrl,
    type: "website",
    locale: "en_GH",
    images: [
      {
        url: "/opengraph-image.png",
        alt: BRAND_LOGO_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — Beauty & Skincare Essentials`,
    description: `Shop ${BRAND_NAME} — premium beauty products in Ghana. ${BRAND_TAGLINE}`,
    images: ["/opengraph-image.png"],
    creator: INSTAGRAM_HANDLE,
    site: INSTAGRAM_HANDLE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: BRAND_LEGAL_NAME,
  alternateName: BRAND_NAME,
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}${BRAND_LOGO_SRC}`,
    width: 512,
    height: 512,
  },
  image: `${siteUrl}${BRAND_LOGO_SRC}`,
  description: `${BRAND_NAME} — premium beauty and skincare products in Ghana. Skincare, lip care, body care, makeup, hair products, and baby essentials.`,
  email: CONTACT_EMAIL,
  telephone: PHONE_INTERNATIONAL_PRIMARY,
  address: {
    "@type": "PostalAddress",
    addressCountry: "GH",
  },
  sameAs: [INSTAGRAM_URL, TIKTOK_URL, WHATSAPP_URL],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: PHONE_INTERNATIONAL_PRIMARY,
    contactType: "customer service",
    availableLanguage: "English",
  },
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: siteUrl,
  name: BRAND_NAME,
  description: `${BRAND_TAGLINE} — Shop beauty & skincare at ${BRAND_NAME}`,
  publisher: { "@id": `${siteUrl}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/shop?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
  inLanguage: "en-GH",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#e8637e" />
        <meta name="msapplication-TileColor" content="#e8637e" />
        <meta name="geo.region" content="GH" />
        <meta name="geo.placename" content="Ghana" />
        <meta name="ICBM" content="7.9465, -1.0232" />
        <link rel="me" href={INSTAGRAM_URL} />
      </head>
      <body className="min-h-full flex flex-col">
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
            strategy="afterInteractive"
          />
        ) : null}
        {children}
        <ChatWidget />
      </body>
    </html>
  )
}
