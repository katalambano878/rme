"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Minus, Plus, ShoppingBag, Trash2, Tag } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCartStore } from "@/lib/store/cart-store"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet"
import type { Product } from "@/types/product"
import { getProductPrimaryImageUrl } from "@/lib/product-image"

function ProductThumbnail({ product }: { product: Product }) {
  return (
    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-rose-light">
      <img
        src={getProductPrimaryImageUrl(product)}
        alt=""
        className="size-full object-cover"
      />
    </div>
  )
}

export function CartDrawer() {
  const items = useCartStore((s) => s.items)
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const getTotal = useCartStore((s) => s.getTotal)
  const getItemCount = useCartStore((s) => s.getItemCount)

  const [coupon, setCoupon] = useState("")
  const total = useMemo(() => getTotal(), [items, getTotal])
  const itemCount = useMemo(() => getItemCount(), [items, getItemCount])

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) closeCart()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col sm:max-w-md"
      >
        <SheetHeader className="border-b border-rose-border/30 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-heading text-lg text-navy">
              Your Bag
              {itemCount > 0 && (
                <span className="ml-2 text-sm font-normal text-navy/50">
                  ({itemCount} {itemCount === 1 ? "item" : "items"})
                </span>
              )}
            </SheetTitle>
            <button
              onClick={closeCart}
              className="rounded-lg p-1.5 text-navy/60 transition-colors hover:bg-rose-light hover:text-navy"
              aria-label="Close cart"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <SheetDescription className="sr-only">
            Your shopping bag contents
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
            <div className="flex size-20 items-center justify-center rounded-full bg-rose-light">
              <ShoppingBag className="size-8 text-rose-soft" />
            </div>
            <div className="text-center">
              <p className="font-heading text-lg text-navy">
                Your bag is empty
              </p>
              <p className="mt-1 text-sm text-navy/50">
                Discover something you love
              </p>
            </div>
            <Button
              onClick={closeCart}
              className="mt-2 rounded-xl bg-navy text-white hover:bg-navy/90"
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => {
                  const price = item.product.salePrice ?? item.product.price
                  const key = `${item.product.id}-${item.selectedSize ?? ""}-${item.selectedColor ?? ""}`

                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 flex gap-3 last:mb-0"
                    >
                      <ProductThumbnail product={item.product} />

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-navy">
                              {item.product.name}
                            </p>
                            {(item.selectedSize || item.selectedColor) && (
                              <p className="mt-0.5 text-xs text-navy/50">
                                {[item.selectedSize, item.selectedColor]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              removeItem(
                                item.product.id,
                                item.selectedSize,
                                item.selectedColor,
                              )
                            }
                            className="shrink-0 rounded-lg p-1 text-navy/40 transition-colors hover:bg-rose-light hover:text-rose-primary"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity - 1,
                                  item.selectedSize,
                                  item.selectedColor,
                                )
                              }
                              className="flex size-6 items-center justify-center rounded-lg border border-rose-border/50 text-navy/60 transition-colors hover:bg-rose-light"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="w-5 text-center text-sm font-medium text-navy">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity + 1,
                                  item.selectedSize,
                                  item.selectedColor,
                                )
                              }
                              className="flex size-6 items-center justify-center rounded-lg border border-rose-border/50 text-navy/60 transition-colors hover:bg-rose-light"
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-navy">
                            {formatPrice(price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            <SheetFooter className="gap-3 border-t border-rose-border/30 pt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-navy/30" />
                  <Input
                    placeholder="Coupon code"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <Button variant="outline" className="h-9 shrink-0 text-sm">
                  Apply
                </Button>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-navy/60">Subtotal</span>
                <span className="font-heading text-lg font-semibold text-navy">
                  {formatPrice(total)}
                </span>
              </div>

              <Link
                href="/cart"
                onClick={closeCart}
                className="flex h-10 items-center justify-center rounded-xl border border-navy text-sm font-medium text-navy transition-colors hover:bg-navy hover:text-white"
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="flex h-10 items-center justify-center rounded-xl bg-rose-100 text-sm font-medium text-navy transition-colors hover:bg-rose-200"
              >
                Checkout
              </Link>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
