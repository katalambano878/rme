"use client"

import Link from "next/link"
import { Heart, ShoppingBag, Star } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import type { Product } from "@/types/product"
import { getProductPrimaryImageUrl } from "@/lib/product-image"

interface ProductCardProps {
  product: Product
  className?: string
  /** `editorial` = full-bleed overlay (home). `catalog` = shop listing layout. */
  variant?: "editorial" | "catalog"
}

function discountLabel(product: Product): string | null {
  if (
    product.badges.includes("Pre-Order") ||
    product.badges.includes("Sale") ||
    product.categorySlug === "preorders" ||
    product.categorySlug === "sale"
  ) {
    return "Pre-Order"
  }
  if (product.salePrice !== undefined && product.price > 0 && product.salePrice < product.price) {
    const pct = Math.round((1 - product.salePrice / product.price) * 100)
    if (pct > 0) return `${pct}% off`
  }
  if (product.isFeatured || product.badges.includes("Best Seller")) return "Featured"
  if (product.badges.includes("New")) return "New"
  if (product.badges.includes("Limited")) return "Limited"
  return null
}

function ActionButtons({
  product,
  alwaysVisibleOnMobile = true,
}: {
  product: Product
  alwaysVisibleOnMobile?: boolean
}) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))

  const btn = cn(
    "flex size-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-navy shadow-sm transition-all hover:scale-105 sm:size-10",
    alwaysVisibleOnMobile
      ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      : "opacity-0 group-hover:opacity-100"
  )

  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-2 sm:right-4 sm:top-4">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggleItem(product)
        }}
        className={cn(btn, isInWishlist && "text-rose-primary opacity-100")}
        aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart className="size-4" fill={isInWishlist ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          addItem(product)
        }}
        className={btn}
        aria-label="Add to bag"
      >
        <ShoppingBag className="size-4" />
      </button>
    </div>
  )
}

function EditorialCard({ product, className }: ProductCardProps) {
  const badge = discountLabel(product)
  const displayPrice = product.salePrice ?? product.price
  const href = `/products/${product.slug}`

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] bg-[#E9E7E3] shadow-[0_12px_28px_-16px_rgba(15,23,42,0.45)] transition-shadow duration-300 hover:shadow-[0_18px_36px_-16px_rgba(15,23,42,0.5)]",
        className
      )}
    >
      <Link
        href={href}
        className="relative block aspect-[3/4] w-full overflow-hidden"
        aria-label={`View ${product.name}`}
      >
        <img
          src={getProductPrimaryImageUrl(product)}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />

        {badge ? (
          <span
            className={cn(
              "pointer-events-none absolute left-3 top-3 z-10 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] sm:left-4 sm:top-4 sm:px-3.5 sm:text-xs",
              badge === "Pre-Order"
                ? "bg-rose-primary text-navy shadow-sm"
                : "bg-navy text-white",
            )}
          >
            {badge}
          </span>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-4 pt-16">
          <p className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-white sm:text-base">
            {product.name}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {formatPrice(displayPrice)}
            </span>
            {product.salePrice !== undefined && product.salePrice < product.price ? (
              <span className="text-xs text-white/70 line-through">
                {formatPrice(product.price)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <ActionButtons product={product} />
    </article>
  )
}

function CatalogCard({ product, className }: ProductCardProps) {
  const badge = discountLabel(product)
  const displayPrice = product.salePrice ?? product.price
  const hasSale =
    product.salePrice !== undefined && product.salePrice < product.price
  const href = `/products/${product.slug}`

  return (
    <article className={cn("group relative", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#E9E7E3]">
        <Link
          href={href}
          className="absolute inset-0 z-0 block"
          aria-label={`View ${product.name}`}
        >
          <img
            src={getProductPrimaryImageUrl(product)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        </Link>

        {badge ? (
          <span
            className={cn(
              "pointer-events-none absolute left-3 top-3 z-10 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]",
              badge === "Pre-Order"
                ? "bg-rose-primary text-navy shadow-sm"
                : "bg-navy text-white",
            )}
          >
            {badge}
          </span>
        ) : null}

        <ActionButtons product={product} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {product.categoryName || "Category"}
          </p>
          {product.rating > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-navy">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <Link href={href}>
          <h3 className="line-clamp-2 font-sans text-[15px] font-semibold leading-snug text-navy transition-colors hover:text-navy/80">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-rose-primary">
            {formatPrice(displayPrice)}
          </span>
          {hasSale ? (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.price)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function ProductCard({
  product,
  className,
  variant = "editorial",
}: ProductCardProps) {
  if (variant === "catalog") {
    return <CatalogCard product={product} className={className} />
  }

  return <EditorialCard product={product} className={className} />
}
