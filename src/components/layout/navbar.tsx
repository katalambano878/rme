"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Heart, ShoppingBag, User, Menu } from "lucide-react"
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { SearchOverlay } from "./search-overlay"
import { cn } from "@/lib/utils"

/** Storefront header — left / center logo / right (all pages) */
const leftNavLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Categories" },
  { href: "/shop", label: "Sale" },
]

/** Mobile drawer — full primary destinations */
const sheetNavLinks = [
  ...leftNavLinks,
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === "/"
  const [heroSolid, setHeroSolid] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const cartItemCount = useCartStore((s) => s.getItemCount())
  const openCart = useCartStore((s) => s.openCart)
  const wishlistCount = useWishlistStore((s) => s.items.length)

  useEffect(() => {
    if (!isHome) {
      setHeroSolid(false)
      return
    }
    const onScroll = () => setHeroSolid(window.scrollY > 2)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isHome])

  /** Home over dark hero: light nav until scrolled; then solid bar + navy */
  const onDarkHero = isHome && !heroSolid
  const iconBtn = cn(
    "rounded-xl p-2 transition-colors",
    onDarkHero
      ? "text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)] hover:bg-white/15"
      : "text-navy hover:bg-rose-light",
    isHome && heroSolid && "hover:bg-rose-100/90"
  )
  const badge = cn(
    "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
    onDarkHero ? "bg-white text-navy shadow-sm" : "bg-rose-200 text-navy"
  )
  const editorialNavLink = cn(
    "font-sans text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
    onDarkHero
      ? "text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] hover:text-white/90"
      : "text-navy hover:text-navy"
  )

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300",
          isHome
            ? heroSolid
              ? "border-b border-rose-border/40 bg-white/95 shadow-sm backdrop-blur-md"
              : "border-b border-transparent bg-transparent"
            : "border-b border-rose-border/40 bg-white/95 shadow-sm backdrop-blur-md"
        )}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          {/* Mobile / tablet */}
          <div className="flex h-[4.25rem] items-center justify-between gap-3 lg:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={cn(
                  "-ml-1 rounded-xl p-2 transition-colors lg:hidden",
                  onDarkHero
                    ? "text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)] hover:bg-white/15"
                    : "text-navy hover:bg-rose-light"
                )}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                className={cn(iconBtn, "-ml-0.5")}
                aria-label="Toggle search"
              >
                <Search className="size-5" />
              </button>
            </div>

            <Link
              href="/"
              className="flex min-w-0 shrink items-center justify-center"
              aria-label={BRAND_NAME}
            >
              <Image
                src={BRAND_LOGO_SRC}
                alt={BRAND_LOGO_ALT}
                width={160}
                height={48}
                className={cn(
                  "h-8 w-auto max-w-[min(42vw,10rem)] object-contain sm:h-9",
                  onDarkHero && "drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
                )}
                priority
              />
            </Link>

            <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
              <Link
                href="/account?tab=wishlist"
                className={cn(iconBtn, "relative")}
                aria-label="Wishlist"
              >
                <Heart className="size-5" />
                {wishlistCount > 0 && (
                  <span className={badge}>{wishlistCount}</span>
                )}
              </Link>
              <button
                type="button"
                onClick={openCart}
                className={cn(iconBtn, "relative")}
                aria-label="Shopping bag"
              >
                <ShoppingBag className="size-5" />
                {cartItemCount > 0 && (
                  <span className={badge}>{cartItemCount}</span>
                )}
              </button>
              <Link
                href="/account"
                className={cn(iconBtn, "hidden sm:flex")}
                aria-label="Account"
              >
                <User className="size-5" />
              </Link>
            </div>
          </div>

          {/* Desktop — editorial layout (all storefront pages) */}
          <div className="hidden h-[4.25rem] grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid">
            <div className="flex min-w-0 items-center gap-5">
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                className={iconBtn}
                aria-label="Toggle search"
              >
                <Search className="size-[1.15rem]" />
              </button>
              <nav className="flex items-center gap-7">
                {leftNavLinks.map((link) => (
                  <Link key={link.label + link.href} href={link.href} className={editorialNavLink}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex justify-center px-4">
              <Link href="/" className="flex items-center" aria-label={BRAND_NAME}>
                <Image
                  src={BRAND_LOGO_SRC}
                  alt={BRAND_LOGO_ALT}
                  width={180}
                  height={54}
                  className={cn(
                    "h-10 w-auto max-w-[14rem] object-contain xl:h-11",
                    onDarkHero && "drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
                  )}
                  priority
                />
              </Link>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-8">
              <button
                type="button"
                onClick={openCart}
                className={cn(editorialNavLink, "cursor-pointer")}
              >
                Cart
              </button>
              <Link href="/account?tab=wishlist" className={editorialNavLink}>
                Wishlist
              </Link>
              <Link href="/about" className={editorialNavLink}>
                About
              </Link>
              <Link href="/account" className={cn(iconBtn, "ml-1")} aria-label="Account">
                <User className="size-[1.15rem]" />
              </Link>
            </div>
          </div>
        </div>

        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </header>

      <Sheet
        open={mobileMenuOpen}
        onOpenChange={(open: boolean) => {
          if (!open) setMobileMenuOpen(false)
        }}
      >
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl text-navy">
              <span className="flex items-center gap-2">
                <Image
                  src={BRAND_LOGO_SRC}
                  alt=""
                  width={140}
                  height={42}
                  className="h-8 w-auto max-w-[10rem] object-contain"
                />
              </span>
            </SheetTitle>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
          </SheetHeader>

          <nav className="mt-4 flex flex-col gap-1 px-4">
            {sheetNavLinks.map((link) => (
              <Link
                key={link.label + link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-navy transition-colors hover:bg-rose-light"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-rose-border/30 p-4">
            <Link
              href="/account"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-navy transition-colors hover:bg-rose-light"
            >
              <User className="size-4" />
              My Account
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
