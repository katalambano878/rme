"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2, MapPin, Phone } from "lucide-react"
import { NEWSLETTER_SUCCESS_COPY, useNewsletterSignup } from "@/components/shared/use-newsletter-signup"
import {
  BRAND_LOGO_ALT,
  BRAND_LOGO_SRC,
  BRAND_NAME,
  BRAND_TAGLINE,
  GOOGLE_MAPS_URL,
  INSTAGRAM_URL,
  PHONE_DISPLAY_PRIMARY,
  SNAPCHAT_URL,
  STORE_ADDRESS,
  STORE_HOURS_SHORT,
  TIKTOK_URL,
  WHATSAPP_URL,
} from "@/lib/brand"

const helpLinks = [
  { href: "/track-order", label: "Track your order" },
  { href: "/policies/shipping", label: "Delivery & pickup" },
  { href: "/policies/returns", label: "Returns" },
  { href: "/contact", label: "Contact us" },
]

const aboutLinks = [
  { href: "/about", label: "Our story" },
  { href: "/blog", label: "Beauty journal" },
  { href: "/policies/privacy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms of service" },
]

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const

function InstagramIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg {...iconProps} fill="currentColor">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.8a5.7 5.7 0 1 0 4.91 5.6V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z" />
    </svg>
  )
}

function SnapchatIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 3c3 0 5 2.2 5 5.2v2.3l1.6-.5c.6-.2 1 .6.5 1l-2 1.3c.5 1.6 1.8 2.8 3.4 3.3.5.2.4.8-.1 1-1 .3-1.6.4-1.9.9-.2.4-.1 1-.6 1.1-.7.1-1.6-.3-2.6.2-1 .5-1.8 1.7-3.3 1.7s-2.3-1.2-3.3-1.7c-1-.5-1.9-.1-2.6-.2-.5-.1-.4-.7-.6-1.1-.3-.5-.9-.6-1.9-.9-.5-.2-.6-.8-.1-1 1.6-.5 2.9-1.7 3.4-3.3l-2-1.3c-.5-.4-.1-1.2.5-1l1.6.5V8.2C7 5.2 9 3 12 3z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg {...iconProps} fill="currentColor">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.36A9.9 9.9 0 1 0 12.04 2zm0 18.13a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.08.8.82-3-.2-.31a8.23 8.23 0 1 1 6.96 3.84zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06a6.73 6.73 0 0 1-3.35-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.67.31 2.8 2.8 0 0 0-.87 2.08 4.86 4.86 0 0 0 1.02 2.58 11.1 11.1 0 0 0 4.25 3.76c1.58.68 2.2.74 2.99.62.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.23-.17-.48-.29z" />
    </svg>
  )
}

const socials = [
  { label: "Instagram", href: INSTAGRAM_URL, Icon: InstagramIcon },
  { label: "TikTok", href: TIKTOK_URL, Icon: TikTokIcon },
  { label: "Snapchat", href: SNAPCHAT_URL, Icon: SnapchatIcon },
  { label: "WhatsApp", href: WHATSAPP_URL, Icon: WhatsAppIcon },
]

const linkClass = "text-[15px] text-ink transition-colors hover:text-raspberry"

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string; strong?: boolean }[] }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5">
      <h2 className="mb-1 text-base font-extrabold text-ink">{title}</h2>
      {links.map((link) => (
        <Link
          key={`${link.href}:${link.label}`}
          href={link.href}
          className={link.strong ? "text-[15px] font-bold text-raspberry hover:text-raspberry-deep" : linkClass}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

export function Footer({ shopLinks }: { shopLinks: { href: string; label: string }[] }) {
  const newsletter = useNewsletterSignup("footer")
  const categoryLinks = shopLinks.filter((l) => l.href.startsWith("/shop?category=")).slice(0, 5)

  return (
    <footer className="mt-auto bg-counter text-ink">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-4 pt-12 pb-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] lg:px-10">
        <div className="flex flex-col gap-5">
          <Image
            src={BRAND_LOGO_SRC}
            alt={BRAND_LOGO_ALT}
            width={180}
            height={56}
            className="h-14 w-auto self-start object-contain"
          />
          <p className="max-w-xs text-[15px] leading-relaxed text-mute">
            Genuine beauty, personal-care and home essentials, delivered across Ghana.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-xl bg-white p-3.5 ring-1 ring-line transition-colors hover:ring-ink"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blush text-raspberry">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 text-[14px] leading-snug">
                  <strong className="block text-[15px] font-bold text-ink">Visit our shop</strong>
                  <span className="text-mute">{STORE_ADDRESS}</span>
                  <span className="mt-0.5 block text-mute">{STORE_HOURS_SHORT}</span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl bg-white p-3.5 ring-1 ring-line transition-colors hover:ring-ink"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blush text-raspberry">
                  <Phone className="size-5" aria-hidden />
                </span>
                <span className="text-[14px] leading-snug">
                  <strong className="block text-[15px] font-bold text-ink">Call or WhatsApp</strong>
                  <span className="text-[16px] font-semibold text-ink tabular-nums">{PHONE_DISPLAY_PRIMARY}</span>
                </span>
              </a>
            </li>
          </ul>
        </div>

        <LinkColumn
          title="Shop"
          links={[
            ...categoryLinks,
            { href: "/shop?sale=1", label: "Sale" },
            { href: "/collections", label: "All categories", strong: true },
          ]}
        />
        <LinkColumn title="Help" links={helpLinks} />
        <LinkColumn title="About" links={aboutLinks} />

        <div className="flex flex-col gap-2.5">
          <h2 className="mb-1 text-base font-extrabold text-ink">New arrivals and sales</h2>
          {newsletter.status === "success" ? (
            <p role="status" className="text-[15px] font-semibold text-[#1E6B3A]">
              {NEWSLETTER_SUCCESS_COPY}
            </p>
          ) : (
            <form onSubmit={newsletter.submit} className="flex flex-col gap-2.5">
              <label htmlFor="footer-email" className="text-[15px] text-mute">
                Leave your email to hear about new products and sales.
              </label>
              <div className="flex gap-2">
                <input
                  id="footer-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={newsletter.email}
                  onChange={(e) => newsletter.setEmail(e.target.value)}
                  required
                  disabled={newsletter.status === "submitting"}
                  className="h-12 min-w-0 flex-1 rounded-[10px] border border-field bg-white px-3 text-[16px] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={newsletter.status === "submitting"}
                  className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[10px] bg-brand px-5 text-[15px] font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
                >
                  {newsletter.status === "submitting" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Sign up
                </button>
              </div>
            </form>
          )}
          {newsletter.status === "error" && (
            <p role="alert" className="text-sm font-semibold text-[#B42318]">
              {newsletter.error}
            </p>
          )}
          <h2 className="mt-5 mb-1 text-base font-extrabold text-ink">Follow us</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0" aria-label="Follow us">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${BRAND_NAME} on ${s.label}`}
                  title={s.label}
                  className="flex size-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-line transition-colors hover:bg-ink hover:text-white hover:ring-ink"
                >
                  <s.Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#DAD6D0]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-sm text-mute sm:px-6 lg:px-10">
          <p>
            © 2026 {BRAND_NAME} · {BRAND_TAGLINE} · Pay with Mobile Money
          </p>
          <p className="flex items-center gap-4">
            <span>
              Powered by{" "}
              <a href="https://doctorbarns.com" target="_blank" rel="noopener" className="text-mute underline-offset-2 hover:underline">
                Doctor Barns Tech
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}
