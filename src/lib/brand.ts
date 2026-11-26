/** RonnyandMe — public contact & social (single source of truth) */
export const BRAND_NAME = "RonnyandMe"
/** Matches logo subtitle */
export const BRAND_LEGAL_NAME = "Ronny & Mimi's Essentials"
export const BRAND_TAGLINE = "We've gotcha!!!"

/** Official RME logo — `public/brand/ronnyandme-logo.png` (nav, favicon, OG/Twitter via root metadata). */
export const BRAND_LOGO_SRC = "/brand/ronnyandme-logo.png"
export const BRAND_LOGO_ALT = `${BRAND_NAME} — ${BRAND_LEGAL_NAME}`

/** Public site / policy references (update when you have a live domain) */
export const SITE_DOMAIN = "ronnyandme.com"
export const CONTACT_EMAIL = `hello@${SITE_DOMAIN}`

/** Ghana numbers — call & WhatsApp */
export const PHONE_DISPLAY_PRIMARY = "059 270 7791"
export const PHONE_DISPLAY_SECONDARY = "025 667 8884"
export const PHONE_INTERNATIONAL_PRIMARY = "+233 59 270 7791"
export const PHONE_INTERNATIONAL_SECONDARY = "+233 25 667 8884"
export const WHATSAPP_E164 = "233592707791"
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_E164}`

export const GOOGLE_MAPS_URL =
  "https://maps.app.goo.gl/wrfFT195DiYsV3RJ7?g_st=iwb"

export const INSTAGRAM_URL =
  "https://www.instagram.com/ronnyandm.e?igsh=OXUzeHJrYXNwbzEw&utm_source=qr"
export const INSTAGRAM_HANDLE = "@ronnyandm.e"

export const TIKTOK_URL = "https://www.tiktok.com/@ronnyandm.e"
export const TIKTOK_HANDLE = "ronnyandm.e"

export const SNAPCHAT_URL = "https://snapchat.com/t/OMQUmo66"

/** Shop and pickup-point opening hours (Ghana time). */
export const STORE_ADDRESS = "Manet Ville Estates, East Airport Spintex, Accra"
export const STORE_HOURS = [
  { days: "Monday – Friday", hours: "9:00 AM – 6:00 PM" },
  { days: "Saturday", hours: "10:00 AM – 4:00 PM" },
  { days: "Sunday", hours: "Closed" },
] as const
export const STORE_HOURS_SHORT = "Mon–Fri 9am–6pm, Sat 10am–4pm, closed Sunday"
/** The address customers should email (matches the Contact page). */
export const SUPPORT_EMAIL = "ronnyandme25@gmail.com"
