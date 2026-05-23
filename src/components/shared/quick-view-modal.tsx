"use client"

import { useState, useMemo } from "react"
import { ShoppingBag, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
import type { Product } from "@/types/product"
import { getProductPrimaryImageUrl } from "@/lib/product-image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { BadgeSet } from "./badge-set"

interface QuickViewModalProps {
  open: boolean
  onClose: () => void
  product: Product | null
}

export function QuickViewModal({ open, onClose, product }: QuickViewModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  const sizeVariant = useMemo(
    () => product?.variants.find((v) => v.type === "size"),
    [product]
  )
  const colorVariant = useMemo(
    () => product?.variants.find((v) => v.type === "color"),
    [product]
  )

  if (!product) return null

  const hasSale = product.salePrice !== undefined && product.salePrice < product.price
  const displayPrice = hasSale ? product.salePrice! : product.price

  function handleAddToBag() {
    if (!product) return
    addItem(
      product,
      quantity,
      selectedSize || undefined,
      selectedColor || undefined
    )
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="relative flex aspect-square overflow-hidden bg-rose-light sm:aspect-auto sm:min-h-[420px]">
            <img
              src={getProductPrimaryImageUrl(product)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col p-5 sm:p-6">
            <DialogHeader className="gap-1.5">
              {product.badges.length > 0 && (
                <BadgeSet badges={product.badges} className="mb-1" />
              )}
              <DialogTitle className="font-heading text-xl font-semibold text-navy">
                {product.name}
              </DialogTitle>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {product.categoryName}
              </p>
            </DialogHeader>

            <div className="mt-3 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-3.5",
                      i < Math.round(product.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.reviewCount})
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-xl font-semibold",
                  hasSale ? "text-rose-primary" : "text-navy"
                )}
              >
                {formatPrice(displayPrice)}
              </span>
              {hasSale && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>

            <DialogDescription className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {product.shortDescription}
            </DialogDescription>

            <div className="mt-auto space-y-4 pt-5">
              {sizeVariant && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">
                    {sizeVariant.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sizeVariant.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSelectedSize(opt)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          selectedSize === opt
                            ? "border-rose-primary bg-rose-light text-rose-primary"
                            : "border-rose-border text-navy hover:border-rose-primary/40"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {colorVariant && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy">
                    {colorVariant.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {colorVariant.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSelectedColor(opt)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          selectedColor === opt
                            ? "border-rose-primary bg-rose-light text-rose-primary"
                            : "border-rose-border text-navy hover:border-rose-primary/40"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-rose-border">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex size-9 items-center justify-center text-navy transition-colors hover:text-rose-primary"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-navy">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex size-9 items-center justify-center text-navy transition-colors hover:text-rose-primary"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToBag}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-100 px-5 py-2.5 text-sm font-semibold text-navy transition-all hover:bg-rose-200"
                >
                  <ShoppingBag className="size-4" />
                  Add to Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
