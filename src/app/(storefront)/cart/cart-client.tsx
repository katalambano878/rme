"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { CampaignCartNote } from "@/components/campaign/campaign-notes"
import { Minus, Plus, Smartphone } from "lucide-react"
import { formatPrice, FREE_SHIPPING_THRESHOLD_GHS } from "@/lib/utils"
import type { Product } from "@/types/product"
import { atStockLimit, useCartStore } from "@/lib/store/cart-store"
import { useStorePricing } from "@/components/store-pricing-provider"
import { liveLinePrice } from "@/lib/effective-price"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"
import { Price } from "@/components/shared/price"
import { ProductCard } from "@/components/shared/product-card"

function itemKey(productId: string, size?: string, color?: string) {
  return `${productId}-${size || ""}-${color || ""}`
}

/** The "was" price for a line: `product.price` is the display price, shown struck through when above the charge. */
function wasPriceFor(product: Product, effective: number): number | undefined {
  const was = Number(product.price)
  return Number.isFinite(was) && was > effective ? was : undefined
}

function optionLabel(size?: string, color?: string) {
  return [size && `Size: ${size}`, color && `Color: ${color}`].filter(Boolean).join(" · ")
}

export type CartPageClientProps = {
  recommendations: Product[]
}

export default function CartPageClient({
  recommendations,
}: CartPageClientProps) {
  const [mounted, setMounted] = useState(false)

  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const storePricing = useStorePricing()

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        return sum + liveLinePrice(item.product, storePricing) * item.quantity
      }, 0),
    [items, storePricing],
  )

  const savings = useMemo(
    () =>
      items.reduce((sum, item) => {
        const effective = liveLinePrice(item.product, storePricing)
        const was = wasPriceFor(item.product, effective)
        return was === undefined ? sum : sum + (was - effective) * item.quantity
      }, 0),
    [items, storePricing],
  )

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD_GHS
  const toFree = Math.max(0, FREE_SHIPPING_THRESHOLD_GHS - subtotal)
  const freePct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD_GHS) * 100)

  if (!mounted) {
    return <main className="min-h-[60vh]" />
  }

  return (
    <main className="bg-white text-ink">
      <div className="mx-auto max-w-[1440px] px-4 pt-7 pb-16 sm:px-6 lg:px-10">
        <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          Your bag
        </h1>
        {itemCount > 0 && (
          <p className="mt-1.5 text-base text-mute">
            {itemCount} {itemCount === 1 ? "item" : "items"}
            {savings > 0 && " · prices include today's sale"}
          </p>
        )}

        {items.length === 0 ? (
          <div className="mt-7 flex max-w-2xl flex-col items-start gap-3 rounded-2xl bg-counter p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold">Your bag is empty</h2>
            <p className="text-base text-mute">
              Restock your favourites, or search for what you need.
            </p>
            <Link
              href="/shop"
              className="mt-1 inline-flex min-h-[52px] items-center rounded-xl bg-brand px-6 text-base font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Shop essentials
            </Link>
          </div>
        ) : (
          <div className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section aria-label="Items" className="flex min-w-0 flex-col gap-5">
              <div className="flex flex-col gap-2.5 rounded-[14px] bg-counter px-5 py-[18px]">
                <p className="text-[15px] leading-[1.45]">
                  {freeShipping ? (
                    <strong className="font-bold">Your order gets free delivery.</strong>
                  ) : (
                    <>
                      <strong className="font-bold">
                        Add {formatPrice(toFree)} more for free delivery.
                      </strong>{" "}
                      Or choose free pickup at Spintex at checkout.
                    </>
                  )}
                </p>
                <div
                  role="progressbar"
                  aria-label="Progress to free delivery"
                  aria-valuemin={0}
                  aria-valuemax={FREE_SHIPPING_THRESHOLD_GHS}
                  aria-valuenow={Math.min(subtotal, FREE_SHIPPING_THRESHOLD_GHS)}
                  className="h-2 overflow-hidden rounded-full bg-counter-deep"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${freePct}%` }}
                  />
                </div>
              </div>

              <ul className="border-t border-line">
                {items.map((item) => {
                  const key = itemKey(
                    item.product.id,
                    item.selectedSize,
                    item.selectedColor,
                  )
                  const effectivePrice = liveLinePrice(item.product, storePricing)
                  const was = wasPriceFor(item.product, effectivePrice)
                  const options = optionLabel(item.selectedSize, item.selectedColor)
                  const limit = atStockLimit(item.product, item.quantity)
                  const href = `/products/${item.product.slug}`

                  return (
                    <li
                      key={key}
                      className="flex items-start gap-4 border-b border-line py-[22px] sm:gap-5"
                    >
                      <Link
                        href={href}
                        tabIndex={-1}
                        aria-hidden
                        className="size-24 shrink-0 overflow-hidden rounded-[14px] bg-counter sm:size-[120px]"
                      >
                        <img
                          src={optimizedImageUrl(getProductPrimaryImageUrl(item.product), 240)}
                          alt=""
                          className="size-full object-cover"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <h2 className="text-[17px] leading-[1.3] font-bold sm:text-lg">
                            <Link href={href} className="text-ink transition-colors hover:text-raspberry">
                              {item.product.name}
                            </Link>
                          </h2>
                          {options && <p className="text-[15px] text-mute">{options}</p>}
                          <Price
                            amount={was ?? effectivePrice}
                            salePrice={was !== undefined ? effectivePrice : undefined}
                            size="sm"
                            className="[&>span]:text-base [&>span]:font-bold"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-2">
                            <div className="flex h-[46px] items-center rounded-xl border-2 border-brand">
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
                                aria-label={`One fewer ${item.product.name}`}
                                className="flex h-full w-11 items-center justify-center rounded-l-[10px] text-ink transition-colors hover:bg-counter"
                              >
                                <Minus className="size-4" aria-hidden />
                              </button>
                              <span
                                aria-live="polite"
                                className="min-w-7 text-center text-base font-bold tabular-nums"
                              >
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
                                aria-label={`One more ${item.product.name}`}
                                title={limit ? "No more in stock" : undefined}
                                className="flex h-full w-11 items-center justify-center rounded-r-[10px] text-ink transition-colors hover:bg-counter disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                              aria-label={`Remove ${item.product.name}`}
                              className="min-h-11 px-1 text-[15px] font-semibold text-mute underline underline-offset-4 transition-colors hover:text-ink"
                            >
                              Remove
                            </button>
                          </div>
                          {limit && (
                            <p className="text-sm text-mute">No more in stock</p>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-extrabold tabular-nums sm:mt-0 sm:text-[19px]">
                          {formatPrice(effectivePrice * item.quantity)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <Link
                href="/shop"
                className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
              >
                ← Keep shopping
              </Link>
            </section>

            <aside
              aria-label="Order summary"
              className="flex w-full flex-col gap-4 rounded-[18px] border-2 border-brand p-5 sm:p-[26px] lg:sticky lg:top-6"
            >
              <h2 className="text-[22px] font-extrabold">Summary</h2>
              <dl className="grid grid-cols-[1fr_auto] gap-y-3 text-base tabular-nums">
                <dt>Items ({itemCount})</dt>
                <dd className="text-right font-semibold">{formatPrice(subtotal)}</dd>
                {savings > 0 && (
                  <>
                    <dt className="text-[#1E6B3A]">You save</dt>
                    <dd className="text-right font-bold text-[#1E6B3A]">{formatPrice(savings)}</dd>
                  </>
                )}
                <dt>Delivery</dt>
                <dd className="text-right text-mute">
                  {freeShipping ? "Free" : "Choose at checkout"}
                </dd>
              </dl>
              <p className="text-sm leading-normal text-mute">
                Pickup at Spintex is free. Doorstep delivery goes anywhere in Ghana; the fee depends on your area,
                and we tell you the exact amount before we send your order.{" "}
                <Link href="/policies/shipping" className="font-semibold text-ink underline underline-offset-2">
                  Delivery details
                </Link>
              </p>
              <CampaignCartNote />
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3.5">
                <span className="text-lg font-bold">Total now</span>
                <span className="text-[26px] font-extrabold tabular-nums sm:text-[30px]">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-brand text-[17px] font-bold text-white transition-colors hover:bg-brand-deep"
              >
                Check out
              </Link>
              <p className="flex items-center justify-center gap-2 text-sm text-mute">
                <Smartphone className="size-[18px]" aria-hidden />
                Pay with Mobile Money · no account needed
              </p>
            </aside>
          </div>
        )}

        {recommendations.length > 0 && (
          <section className="mt-14 flex flex-col gap-5">
            <h2 className="text-[24px] font-extrabold tracking-[-0.02em] sm:text-[28px]">
              Running low on these?
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
              {recommendations.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
