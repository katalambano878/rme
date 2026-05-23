/**
 * In-memory site knowledge for the AI assistant (RonnyandMe storefront).
 */

import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTACT_EMAIL,
  PHONE_DISPLAY_PRIMARY,
  PHONE_INTERNATIONAL_PRIMARY,
  WHATSAPP_URL,
  INSTAGRAM_URL,
  TIKTOK_URL,
} from "@/lib/brand"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"

export interface SiteKnowledgeEntry {
  id: string
  title: string
  path: string
  category: string
  content: string
  keywords: string[]
}

const freeShip = formatFreeShippingMinimumLabel()

export const SITE_KNOWLEDGE: SiteKnowledgeEntry[] = [
  {
    id: "about-brand",
    title: `About ${BRAND_NAME}`,
    path: "/about",
    category: "company",
    content: `${BRAND_NAME} — ${BRAND_TAGLINE}. We sell skincare, lip care, body care, makeup, hair products, and baby essentials. Based in Ghana with delivery nationwide.`,
    keywords: ["about", "who", "brand", "mission", "company", "ronny", "essentials"],
  },
  {
    id: "contact",
    title: "Contact us",
    path: "/contact",
    category: "contact",
    content: `Email: ${CONTACT_EMAIL}. Phone: ${PHONE_DISPLAY_PRIMARY} (${PHONE_INTERNATIONAL_PRIMARY}). WhatsApp: ${WHATSAPP_URL}. Instagram: ${INSTAGRAM_URL}. TikTok: ${TIKTOK_URL}.`,
    keywords: ["contact", "phone", "email", "whatsapp", "call", "reach", "support"],
  },
  {
    id: "shipping",
    title: "Shipping",
    path: "/policies/shipping",
    category: "shipping",
    content: `Shipping policy and timelines are on /policies/shipping. ${freeShip} standard shipping may apply on qualifying orders — see checkout for your cart.`,
    keywords: ["shipping", "delivery", "how long", "dispatch", "track package"],
  },
  {
    id: "returns",
    title: "Returns",
    path: "/policies/returns",
    category: "returns",
    content: `Returns and exchanges are explained on /policies/returns. Use /track-order for order status.`,
    keywords: ["return", "refund", "exchange", "wrong item"],
  },
  {
    id: "payment",
    title: "Payment",
    path: "/checkout",
    category: "payment",
    content: `Checkout uses Paystack (cards and mobile money) in GHS. Guest checkout is supported.`,
    keywords: ["pay", "payment", "card", "momo", "mobile money", "paystack"],
  },
  {
    id: "shop",
    title: "Shop",
    path: "/shop",
    category: "shopping",
    content: `Browse all products at /shop with filters. Product detail pages are at /products/[slug].`,
    keywords: ["shop", "browse", "buy", "products", "catalog"],
  },
  {
    id: "track-order",
    title: "Track order",
    path: "/track-order",
    category: "orders",
    content: `Track orders at /track-order with order number and email. Logged-in users can also use /account.`,
    keywords: ["track", "order status", "where is my order", "delivery status"],
  },
  {
    id: "account",
    title: "Account",
    path: "/account",
    category: "account",
    content: `Sign in at /auth/login, create an account at /auth/signup. Manage profile and orders at /account.`,
    keywords: ["account", "login", "sign in", "password", "profile", "orders"],
  },
  {
    id: "cart-checkout",
    title: "Cart & checkout",
    path: "/cart",
    category: "shopping",
    content: `Cart: /cart. Checkout: /checkout. You can also use the chat assistant to get product help and links.`,
    keywords: ["cart", "checkout", "bag", "pay now"],
  },
  {
    id: "privacy-terms",
    title: "Legal",
    path: "/policies/privacy",
    category: "legal",
    content: `Privacy: /policies/privacy. Terms: /policies/terms.`,
    keywords: ["privacy", "terms", "legal", "data"],
  },
]

export function searchSiteKnowledge(query: string, maxResults = 3): SiteKnowledgeEntry[] {
  const lower = query.toLowerCase()
  const words = lower.split(/\s+/).filter((w) => w.length > 2)

  const scored = SITE_KNOWLEDGE.map((entry) => {
    let score = 0
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score += 10
      for (const word of words) {
        if (kw.includes(word) || word.includes(kw)) score += 3
      }
    }
    if (entry.title.toLowerCase().includes(lower)) score += 15
    for (const word of words) {
      if (entry.title.toLowerCase().includes(word)) score += 5
    }
    const contentLower = entry.content.toLowerCase()
    for (const word of words) {
      if (contentLower.includes(word)) score += 2
    }
    return { entry, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.entry)
}

export function getKnowledgeByCategory(category: string): SiteKnowledgeEntry[] {
  return SITE_KNOWLEDGE.filter((e) => e.category === category)
}

export function getSiteMapSummary(): string {
  return `WEBSITE PAGES (help customers navigate):
- / — Homepage, featured collections
- /shop — All products
- /products/[slug] — Product detail
- /cart — Shopping cart
- /checkout — Paystack checkout
- /track-order — Order tracking
- /account — Account & orders (signed in)
- /auth/login, /auth/signup — Authentication
- /about — About ${BRAND_NAME}
- /contact — Contact form & details
- /blog — Blog
- /policies/shipping, /policies/returns, /policies/privacy, /policies/terms`
}
