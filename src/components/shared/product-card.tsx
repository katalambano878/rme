"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Heart, ShoppingBag, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import type { Product } from "@/types/product"
import { getProductPrimaryImageUrl } from "@/lib/product-image"
import { BadgeSet } from "./badge-set"
import { Price } from "./price"

interface ProductCardProps {
  product: Product
  className?: string
  onQuickView?: (product: Product) => void
}

export function ProductCard({ product, className, onQuickView }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))

  return (
    <motion.div
      className={cn("group relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-rose-light">
          <img
            src={getProductPrimaryImageUrl(product)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />

          {product.badges.length > 0 && (
            <div className="absolute top-3 left-3 z-10">
              <BadgeSet
                badges={product.badges}
                discountPercent={
                  product.salePrice !== undefined && product.price > 0
                    ? Math.round((1 - product.salePrice / product.price) * 100)
                    : undefined
                }
              />
            </div>
          )}

          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-navy/30 backdrop-blur-[2px]"
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            style={{ pointerEvents: isHovered ? "auto" : "none" }}
          >
            <button
              onClick={(e) => {
                e.preventDefault()
                onQuickView?.(product)
              }}
              className="flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-medium text-navy shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
            >
              <Eye className="size-4" />
              Quick View
            </button>
          </motion.div>
        </div>
      </Link>

      <button
        onClick={() => toggleItem(product)}
        className={cn(
          "absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:scale-110",
          isInWishlist && "text-rose-primary"
        )}
        aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className="size-4"
          fill={isInWishlist ? "currentColor" : "none"}
        />
      </button>

      <div className="mt-3.5 space-y-1.5 px-0.5">
        <Link href={`/products/${product.slug}`} className="block">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {product.categoryName}
          </p>
          <h3 className="mt-0.5 font-heading text-base font-semibold text-navy transition-colors group-hover:text-rose-primary">
            {product.name}
          </h3>
        </Link>

        <Price amount={product.price} salePrice={product.salePrice} size="sm" />

        <button
          onClick={() => addItem(product)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-border bg-white py-2.5 text-sm font-medium text-navy transition-all hover:border-rose-primary hover:bg-rose-light hover:text-rose-primary"
        >
          <ShoppingBag className="size-4" />
          Add to Bag
        </button>
      </div>
    </motion.div>
  )
}
