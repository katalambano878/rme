"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { Minus, Plus, X } from "lucide-react"
import { atStockLimit, useCartStore } from "@/lib/store/cart-store"
import { formatPrice, FREE_SHIPPING_THRESHOLD_GHS } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet"
import type { Product } from "@/types/product"
import { useStorePricing } from "@/components/store-pricing-provider"
import { liveLinePrice } from "@/lib/effective-price"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"
import { Price } from "@/components/shared/price"

const CART_HISTORY_FLAG = "__rmeCartDrawer"

/** `product.price` is the display price; it's the struck-through "was" when above the charge. */
function wasPriceFor(product: Product, effective: number): number | undefined {
  const was = Number(product.price)
  return Number.isFinite(was) && was > effective ? was : undefined
}

function ProductThumbnail({ product }: { product: Product }) {
  return (
    <div className="size-[76px] shrink-0 overflow-hidden rounded-xl bg-counter">
      <img
        src={optimizedImageUrl(getProductPrimaryImageUrl(product), 160)}
        alt=""
        className="size-full object-cover"
        decoding="async"
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
  const getItemCount = useCartStore((s) => s.getItemCount)
  const storePricing = useStorePricing()

  const total = useMemo(
    () => items.reduce((sum, item) => sum + liveLinePrice(item.product, storePricing) * item.quantity, 0),
    [items, storePricing],
  )
  const itemCount = useMemo(() => getItemCount(), [items, getItemCount])
  const freeShipping = total >= FREE_SHIPPING_THRESHOLD_GHS
  const toFree = Math.max(0, FREE_SHIPPING_THRESHOLD_GHS - total)
  const freePct = Math.min(100, (total / FREE_SHIPPING_THRESHOLD_GHS) * 100)

  // Give the open drawer its own history entry so the phone/browser Back button
  // closes the bag instead of leaving the page the shopper is browsing.
  const historyEntryPushed = useRef(false)
  const leavingViaLink = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      if (historyEntryPushed.current) {
        historyEntryPushed.current = false
        if (!leavingViaLink.current && window.history.state?.[CART_HISTORY_FLAG]) {
          window.history.back()
        }
      }
      leavingViaLink.current = false
      return
    }
    if (!historyEntryPushed.current) {
      window.history.pushState({ [CART_HISTORY_FLAG]: true }, "")
      historyEntryPushed.current = true
    }
    const onPopState = () => {
      historyEntryPushed.current = false
      closeCart()
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [isOpen, closeCart])

  const closeForNavigation = () => {
    leavingViaLink.current = true
    closeCart()
  }

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
        className="store flex w-full flex-col gap-0 bg-white text-ink sm:max-w-md"
      >
        <SheetHeader className="border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
              Your bag
              {itemCount > 0 && (
                <span className="ml-2 text-base font-medium text-mute">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              )}
            </SheetTitle>
            <button
              type="button"
              onClick={closeCart}
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-counter"
              aria-label="Close cart"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <SheetDescription className="sr-only">
            Your shopping bag contents
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start gap-3 p-5">
            <div className="flex w-full flex-col items-start gap-3 rounded-2xl bg-counter p-6">
              <p className="text-xl font-extrabold">Your bag is empty</p>
              <p className="text-[15px] text-mute">
                Restock your favourites, or search for what you need.
              </p>
              <button
                type="button"
                onClick={closeCart}
                className="mt-1 inline-flex min-h-[52px] items-center rounded-xl bg-brand px-6 text-base font-bold text-white transition-colors hover:bg-brand-deep"
              >
                Keep shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-5 py-4">
              <p className="text-[15px] leading-[1.45]">
                {freeShipping ? (
                  <strong className="font-bold">Your order gets free delivery.</strong>
                ) : (
                  <>
                    <strong className="font-bold">Add {formatPrice(toFree)} more for free delivery.</strong>{" "}
                    Or pick up free at Spintex.
                  </>
                )}
              </p>
              <div
                role="progressbar"
                aria-label="Progress to free delivery"
                aria-valuemin={0}
                aria-valuemax={FREE_SHIPPING_THRESHOLD_GHS}
                aria-valuenow={Math.min(total, FREE_SHIPPING_THRESHOLD_GHS)}
                className="mt-2.5 h-2 overflow-hidden rounded-full bg-counter-deep"
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${freePct}%` }}
                />
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto overscroll-contain px-5">
              {items.map((item) => {
                const price = liveLinePrice(item.product, storePricing)
                const was = wasPriceFor(item.product, price)
                const limit = atStockLimit(item.product, item.quantity)
                const key = `${item.product.id}-${item.selectedSize ?? ""}-${item.selectedColor ?? ""}`

                return (
                  <li key={key} className="flex gap-3.5 border-b border-line py-4 last:border-b-0">
                    <ProductThumbnail product={item.product} />

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-[15px] leading-snug font-bold">
                          <Link
                            href={`/products/${item.product.slug}`}
                            onClick={closeForNavigation}
                            className="text-ink transition-colors hover:text-raspberry"
                          >
                            {item.product.name}
                          </Link>
                        </p>
                        <p className="shrink-0 text-[15px] font-extrabold tabular-nums">
                          {formatPrice(price * item.quantity)}
                        </p>
                      </div>
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-sm text-mute">
                          {[item.selectedSize, item.selectedColor]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      )}
                      <Price
                        amount={was ?? price}
                        salePrice={was !== undefined ? price : undefined}
                        size="sm"
                        className="[&>s]:text-[13px] [&>span]:text-sm [&>span]:font-bold"
                      />

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex h-11 items-center rounded-xl border-2 border-brand">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity - 1,
                                item.selectedSize,
                                item.selectedColor,
                              )
                            }
                            className="flex h-full w-11 items-center justify-center rounded-l-[10px] text-ink transition-colors hover:bg-counter"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-4" aria-hidden />
                          </button>
                          <span aria-live="polite" className="min-w-6 text-center text-[15px] font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity + 1,
                                item.selectedSize,
                                item.selectedColor,
                              )
                            }
                            disabled={limit}
                            title={limit ? "No more in stock" : undefined}
                            className="flex h-full w-11 items-center justify-center rounded-r-[10px] text-ink transition-colors hover:bg-counter disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-4" aria-hidden />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              item.product.id,
                              item.selectedSize,
                              item.selectedColor,
                            )
                          }
                          className="min-h-11 px-1 text-sm font-semibold text-mute underline underline-offset-4 transition-colors hover:text-ink"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          Remove
                        </button>
                      </div>
                      {limit && <p className="text-[13px] text-mute">No more in stock</p>}
                    </div>
                  </li>
                )
              })}
            </ul>

            <SheetFooter className="gap-3 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-bold">Subtotal</span>
                <span className="text-[22px] font-extrabold tabular-nums">
                  {formatPrice(total)}
                </span>
              </div>
              <p className="text-sm text-mute">Delivery is chosen at checkout.</p>

              <Link
                href="/checkout"
                onClick={closeForNavigation}
                className="flex min-h-14 items-center justify-center rounded-xl bg-brand text-[17px] font-bold text-white transition-colors hover:bg-brand-deep"
              >
                Check out
              </Link>
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/cart"
                  onClick={closeForNavigation}
                  className="inline-flex min-h-11 items-center text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
                >
                  View bag
                </Link>
                <button
                  type="button"
                  onClick={closeCart}
                  className="inline-flex min-h-11 items-center text-[15px] font-semibold text-mute underline underline-offset-4 transition-colors hover:text-ink"
                >
                  Keep shopping
                </button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
