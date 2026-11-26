"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
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

const socials = [
  { label: "Instagram", href: INSTAGRAM_URL },
  { label: "TikTok", href: TIKTOK_URL },
  { label: "Snapchat", href: SNAPCHAT_URL },
  { label: "WhatsApp", href: WHATSAPP_URL },
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
        <div className="flex flex-col gap-3">
          <Image
            src={BRAND_LOGO_SRC}
            alt={BRAND_LOGO_ALT}
            width={180}
            height={56}
            className="h-14 w-auto self-start object-contain"
          />
          <p className="text-[15px] leading-relaxed text-mute">
            Genuine beauty, personal-care and home essentials.{" "}
            <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer" className="text-mute underline underline-offset-2 hover:text-ink">
              Manet Ville Estates, East Airport Spintex, Accra
            </a>
            .
          </p>
          <p className="text-[15px] text-mute">
            Call or WhatsApp{" "}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-raspberry">
              {PHONE_DISPLAY_PRIMARY}
            </a>
          </p>
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
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Follow us">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {s.label}
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
