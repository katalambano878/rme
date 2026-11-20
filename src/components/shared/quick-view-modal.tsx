"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Minus, Plus, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
import type { Product } from "@/types/product"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { BadgeSet } from "./badge-set"
import { Price, savePercent } from "./price"

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

  const [optionsForProductId, setOptionsForProductId] = useState(product?.id)
  if (product?.id !== optionsForProductId) {
    setOptionsForProductId(product?.id)
    setSelectedSize("")
    setSelectedColor("")
    setQuantity(1)
  }

  if (!product) return null

  const hasSale = product.salePrice !== undefined && product.salePrice < product.price
  const displayPrice = hasSale ? product.salePrice! : product.price
  const pct = savePercent(product.price, product.salePrice)
  const missingOption =
    sizeVariant && !selectedSize
      ? sizeVariant.name || "size"
      : colorVariant && !selectedColor
        ? colorVariant.name || "color"
        : null

  function handleAddToBag() {
    if (!product || missingOption || !(product.price > 0)) return
    addItem(
      product,
      quantity,
      selectedSize || undefined,
      selectedColor || undefined
    )
    onClose()
  }

  const optionGroups = [colorVariant, sizeVariant].filter(
    (v): v is NonNullable<typeof v> => !!v
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="store max-h-[calc(100dvh-2rem)] max-w-2xl gap-0 overflow-y-auto rounded-[20px] bg-white p-0 text-ink ring-0 sm:max-w-2xl"
      >
        <DialogClose
          aria-label="Close"
          className="absolute top-2 right-2 z-20 inline-flex size-11 items-center justify-center rounded-full text-ink"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-counter">
            <X className="size-[18px]" aria-hidden />
          </span>
        </DialogClose>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="relative aspect-square overflow-hidden bg-counter sm:aspect-auto sm:min-h-[440px]">
            <img
              src={optimizedImageUrl(getProductPrimaryImageUrl(product), 800)}
              alt=""
              className="size-full object-cover"
              decoding="async"
            />
            {product.badges.length > 0 && (
              <div className="absolute top-3 left-3">
                <BadgeSet
                  badges={
                    pct !== undefined
                      ? product.badges.filter((b) => b !== "Sale")
                      : product.badges
                  }
                />
              </div>
            )}
          </div>

          <div className="flex flex-col p-5 sm:p-6">
            <DialogHeader className="gap-1.5 pr-8">
              {product.categoryName && (
                <p className="text-sm font-bold text-mute">{product.categoryName}</p>
              )}
              <DialogTitle className="text-[24px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            {product.reviewCount > 0 && product.rating > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-mute">
                <Star className="size-3.5 fill-ink text-ink" aria-hidden />
                <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
                <span aria-hidden>·</span>
                <span>
                  {product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"}
                </span>
              </p>
            )}

            {displayPrice > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Price amount={product.price} salePrice={product.salePrice} size="md" />
                {pct !== undefined && (
                  <span className="rounded-lg bg-blush px-2 py-0.5 text-[13px] font-bold text-raspberry">
                    Save {pct}%
                  </span>
                )}
              </div>
            )}

            <DialogDescription className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-mute">
              {product.shortDescription}
            </DialogDescription>

            <div className="mt-auto flex flex-col gap-5 pt-5">
              {optionGroups.map((group) => {
                const isSize = group.type === "size"
                const selected = isSize ? selectedSize : selectedColor
                const setSelected = isSize ? setSelectedSize : setSelectedColor
                return (
                  <fieldset key={group.id} className="m-0 border-0 p-0">
                    <legend className="mb-2.5 p-0 text-[15px] font-bold text-ink">
                      {group.name || (isSize ? "Size" : "Shade")}:{" "}
                      <span className="font-medium">{selected || "pick one"}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelected(opt)}
                          aria-pressed={selected === opt}
                          className={cn(
                            "inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold transition-colors",
                            selected === opt
                              ? "border-2 border-brand bg-brand text-white"
                              : "border border-field bg-white text-ink hover:border-ink"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )
              })}

              <div className="flex flex-wrap gap-3">
                <div className="flex h-[52px] items-center rounded-xl border-2 border-brand">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex h-full w-11 items-center justify-center text-ink disabled:text-field"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-[18px]" aria-hidden />
                  </button>
                  <span
                    aria-live="polite"
                    aria-label={`Quantity ${quantity}`}
                    className="min-w-7 text-center text-base font-bold tabular-nums"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-full w-11 items-center justify-center text-ink"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-[18px]" aria-hidden />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToBag}
                  disabled={!!missingOption || !(product.price > 0)}
                  className="inline-flex min-h-[52px] flex-[1_1_160px] items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-counter disabled:text-[#6B7080]"
                >
                  {missingOption ? `Choose ${missingOption.toLowerCase()}` : "Add to bag"}
                </button>
              </div>

              <Link
                href={`/products/${product.slug}`}
                onClick={onClose}
                className="self-start text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
              >
                See full details
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
