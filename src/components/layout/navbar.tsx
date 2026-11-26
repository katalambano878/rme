"use client"

import { Suspense, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, ShoppingBag, User } from "lucide-react"
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand"
import { useCartStore } from "@/lib/store/cart-store"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HeaderSearch } from "./header-search"
import { useCampaign } from "@/components/campaign/campaign-context"
import { cn } from "@/lib/utils"

const mainLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?sale=1", label: "Sale", sale: true },
  { href: "/track-order", label: "Track order" },
]

const menuLinks = [
  { href: "/shop", label: "Shop all" },
  { href: "/shop?sale=1", label: "Sale" },
  { href: "/collections", label: "Categories" },
  { href: "/track-order", label: "Track order" },
  { href: "/account", label: "Your account" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact us" },
]

function SearchFallback() {
  return <div className="h-12 rounded-xl border-2 border-brand" aria-hidden />
}

export function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const hydrated = useHydrated()
  const storedCount = useCartStore((s) => s.getItemCount())
  const openCart = useCartStore((s) => s.openCart)
  const bagCount = hydrated ? storedCount : 0
  const onAccount = pathname.startsWith("/account")
  const { campaign, state: campaignNow } = useCampaign()
  // During Black Friday the Sale link becomes the campaign's own name.
  // At 0% (promotion only) the Sale link keeps its everyday name.
  const saleLabel = campaignNow === "live" && campaign && campaign.discountPercent > 0 ? campaign.name : "Sale"

  const bagButton = (
    <button
      type="button"
      onClick={openCart}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-counter px-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-counter-deep sm:px-4"
      aria-label={`Bag, ${bagCount} ${bagCount === 1 ? "item" : "items"}`}
    >
      <ShoppingBag className="size-5" aria-hidden />
      <span aria-hidden>
        <span className="hidden sm:inline">Bag · </span>
        <span className="tabular-nums">{bagCount}</span>
      </span>
    </button>
  )

  const accountLink = (
    <Link
      href="/account"
      aria-label="Your account"
      aria-current={onAccount ? "page" : undefined}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-counter",
        onAccount && "bg-blush hover:bg-blush",
      )}
    >
      <User className="size-[22px]" aria-hidden />
    </Link>
  )

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          {/* Phones and tablets: menu, logo, account, bag — then search underneath */}
          <div className="flex items-center gap-2 pt-3 pb-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="-ml-2 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-counter"
              aria-label="Open menu"
            >
              <Menu className="size-6" aria-hidden />
            </button>
            <Link href="/" aria-label={`${BRAND_NAME} home`} className="mr-auto flex items-center">
              <Image
                src={BRAND_LOGO_SRC}
                alt={BRAND_LOGO_ALT}
                width={160}
                height={48}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
            {accountLink}
            {bagButton}
          </div>
          <div className="pb-3 lg:hidden">
            <Suspense fallback={<SearchFallback />}>
              <HeaderSearch />
            </Suspense>
          </div>

          {/* Desktop */}
          <div className="hidden items-center gap-8 py-4 lg:flex">
            <Link href="/" aria-label={`${BRAND_NAME} home`} className="shrink-0">
              <Image
                src={BRAND_LOGO_SRC}
                alt={BRAND_LOGO_ALT}
                width={200}
                height={60}
                className="h-[58px] w-auto object-contain"
                priority
              />
            </Link>
            <Suspense fallback={<SearchFallback />}>
              <HeaderSearch className="min-w-0 flex-1" />
            </Suspense>
            <nav aria-label="Main" className="flex shrink-0 items-center gap-6">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-[15px] font-semibold transition-colors",
                    link.sale ? "text-raspberry hover:text-raspberry-deep" : "text-ink hover:text-raspberry",
                  )}
                >
                  {link.sale ? saleLabel : link.label}
                </Link>
              ))}
              <span className="flex items-center gap-2">
                {accountLink}
                {bagButton}
              </span>
            </nav>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={(open: boolean) => setMenuOpen(open)}>
        <SheetContent side="left" className="store w-80">
          <SheetHeader>
            <SheetTitle>
              <Image
                src={BRAND_LOGO_SRC}
                alt={BRAND_LOGO_ALT}
                width={140}
                height={42}
                className="h-10 w-auto object-contain"
              />
            </SheetTitle>
            <SheetDescription className="sr-only">Site menu</SheetDescription>
          </SheetHeader>
          <nav aria-label="Menu" className="flex flex-col px-3">
            {menuLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center rounded-xl px-3 text-[17px] font-semibold text-ink hover:bg-counter"
              >
                {link.href === "/shop?sale=1" ? saleLabel : link.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
