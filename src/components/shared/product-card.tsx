"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { isOutOfStock, useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import type { Product } from "@/types/product"
import { getProductPrimaryImageUrl, optimizedImageUrl } from "@/lib/product-image"
import { Price, savePercent } from "./price"

interface ProductCardProps {
  product: Product
  className?: string
  /** Opens the options picker for products with shades/sizes. Without it, those link to the product page. */
  onQuickView?: (product: Product) => void
  /** Hide the category line (e.g. inside a single-category list). */
  hideCategory?: boolean
}

/** Clean Counter product tile: square photo, category, name, price, one clear button. */
export function ProductCard({ product, className, onQuickView, hideCategory }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const hydrated = useHydrated()
  const storedInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))
  const inWishlist = hydrated && storedInWishlist
  const needsOptions = product.variants.length > 0
  const soldOut = isOutOfStock(product)
  const pct = savePercent(product.price, product.salePrice)
  const href = `/products/${product.slug}`

  const buttonClass =
    "mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-brand bg-white px-3 text-[15px] font-bold text-ink transition-colors hover:bg-brand hover:text-white"

  return (
    <article className={cn("group relative flex h-full flex-col gap-2.5", className)}>
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-counter">
        <Link href={href} tabIndex={-1} aria-hidden className="block size-full">
          <img
            src={optimizedImageUrl(getProductPrimaryImageUrl(product), 480)}
            alt=""
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        </Link>
        {pct !== undefined && (
          <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-lg bg-brand px-2 py-1 text-[13px] font-bold text-white">
            Save {pct}%
          </span>
        )}
        {soldOut && (
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-lg bg-white px-2 py-1 text-[13px] font-bold text-ink">
            Sold out
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleItem(product)}
          aria-pressed={inWishlist}
          aria-label={inWishlist ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className={cn(
            "absolute top-1.5 right-1.5 inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors",
            inWishlist ? "text-raspberry" : "hover:text-raspberry",
          )}
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm">
            <Heart className="size-[18px]" fill={inWishlist ? "currentColor" : "none"} aria-hidden />
          </span>
        </button>
      </div>

      {!hideCategory && (
        <p className="min-h-4 text-[13px] font-semibold text-mute">{product.categoryName}</p>
      )}
      <h3 className="text-base leading-snug font-bold text-ink">
        <Link href={href} className="hover:text-raspberry">
          {product.name}
        </Link>
      </h3>
      <Price amount={product.price} salePrice={product.salePrice} size="sm" />

      {soldOut ? (
        <button
          type="button"
          disabled
          className="mt-auto inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-counter text-[15px] font-bold text-[#6B7080]"
        >
          Sold out
        </button>
      ) : needsOptions && !onQuickView ? (
        <Link href={href} className={buttonClass}>
          Choose options
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => (needsOptions || !(product.price > 0) ? onQuickView?.(product) : addItem(product))}
          className={buttonClass}
        >
          {needsOptions ? "Choose options" : product.price > 0 ? "Add to bag" : "View"}
        </button>
      )}
    </article>
  )
}
