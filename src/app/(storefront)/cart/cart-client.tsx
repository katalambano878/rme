"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  ChevronRight,
  CreditCard,
  Truck,
  ShieldCheck,
  Heart,
  Eye,
} from "lucide-react"
import { cn, formatPrice, FREE_SHIPPING_THRESHOLD_GHS } from "@/lib/utils"
import type { Product } from "@/types/product"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

function itemKey(productId: string, size?: string, color?: string) {
  return `${productId}-${size || ""}-${color || ""}`
}

export type CartPageClientProps = {
  recommendations: Product[]
}

export default function CartPageClient({
  recommendations,
}: CartPageClientProps) {
  const [mounted, setMounted] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [couponApplied, setCouponApplied] = useState(false)

  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = item.product.salePrice ?? item.product.price
        return sum + price * item.quantity
      }, 0),
    [items],
  )

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  const discount = couponApplied ? subtotal * 0.1 : 0
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD_GHS
  const tax = 0
  const estimatedTotal = subtotal - discount

  const handleApplyCoupon = () => {
    if (couponCode.trim().toUpperCase() === "WELCOME10") {
      setCouponApplied(true)
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-[60vh]">
        <Container>
          <div className="py-20" />
        </Container>
      </main>
    )
  }

  return (
    <main>
      <Container>
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="py-6"
        >
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-rose-primary"
              >
                Home
              </Link>
            </li>
            <li>
              <ChevronRight className="size-3.5" />
            </li>
            <li className="font-medium text-navy">Your Bag</li>
          </ol>
        </motion.nav>

        <div className="mb-10">
          <Heading as="h1">
            Your Bag
            {itemCount > 0 && (
              <span className="ml-3 text-2xl font-normal text-muted-foreground">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            )}
          </Heading>
        </div>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="flex size-28 items-center justify-center rounded-full bg-rose-light">
              <ShoppingBag className="size-12 text-rose-primary/40" />
            </div>
            <h3 className="mt-8 font-heading text-2xl font-semibold text-navy">
              Your bag is empty
            </h3>
            <p className="mt-2 text-muted-foreground">
              Discover something you&apos;ll love
            </p>
            <Link href="/" className="mt-8">
              <Button className="h-auto rounded-full px-10 py-3.5 text-base font-semibold">
                Continue Shopping
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
            <div>
              <AnimatePresence mode="popLayout">
                {items.map((item) => {
                  const key = itemKey(
                    item.product.id,
                    item.selectedSize,
                    item.selectedColor,
                  )
                  const effectivePrice =
                    item.product.salePrice ?? item.product.price

                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        x: -80,
                        transition: { duration: 0.25 },
                      }}
                      transition={{
                        duration: 0.4,
                        ease: [0.22, 1, 0.36, 1] as const,
                      }}
                      className="mb-4 rounded-2xl border border-rose-border/40 bg-white px-5 py-5 shadow-[0_8px_26px_-20px_rgba(15,23,42,0.45)]"
                    >
                      <div className="flex gap-4 sm:gap-5">
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="shrink-0"
                        >
                          <div className="size-[76px] overflow-hidden rounded-xl bg-rose-light sm:size-[84px]">
                            <img
                              src={optimizedImageUrl(getProductPrimaryImageUrl(item.product), 160)}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/products/${item.product.slug}`}
                                className="font-heading text-[30px] font-semibold leading-tight text-navy transition-colors hover:text-rose-primary"
                              >
                                {item.product.name}
                              </Link>
                              <p className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-primary">
                                {item.product.categoryName || "Category"}
                              </p>
                              {(item.selectedSize || item.selectedColor) && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.selectedSize &&
                                    `Size: ${item.selectedSize}`}
                                  {item.selectedSize &&
                                    item.selectedColor &&
                                    " · "}
                                  {item.selectedColor &&
                                    `Color: ${item.selectedColor}`}
                                </p>
                              )}
                              <p className="mt-2 text-[24px] font-semibold leading-none text-rose-primary">
                                {formatPrice(effectivePrice)}
                              </p>
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
                              className="hidden shrink-0 text-muted-foreground transition-colors hover:text-rose-primary sm:block"
                              aria-label="Remove item"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="mt-5 flex items-end justify-between">
                            <div className="flex items-center gap-2">
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
                                className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-primary transition-colors hover:bg-rose-200"
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <span className="w-8 text-center text-base font-semibold text-navy">
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
                                className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-primary transition-colors hover:bg-rose-200"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>

                            <div className="flex items-end gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Subtotal</p>
                                <span className="text-[22px] font-semibold leading-none text-navy">
                                  {formatPrice(effectivePrice * item.quantity)}
                                </span>
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
                                className="text-muted-foreground transition-colors hover:text-rose-primary sm:hidden"
                                aria-label="Remove item"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.2,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
                className="sticky top-6"
              >
                <Card className="overflow-visible rounded-2xl border-rose-border/40 bg-[#FFF5F5] shadow-[0_14px_34px_-24px_rgba(15,23,42,0.5)]">
                  <CardContent className="space-y-5 p-6">
                    <h3 className="font-heading text-[36px] font-semibold leading-tight text-navy">
                      Order Summary
                    </h3>

                    <div className="space-y-3.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold text-navy">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span
                          className={cn(
                            "font-medium",
                            freeShipping
                              ? "text-emerald-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {freeShipping ? "Free" : formatPrice(0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-semibold text-navy">{formatPrice(tax)}</span>
                      </div>
                    </div>

                    {couponApplied && (
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Discount applied: WELCOME10 (-{formatPrice(discount)})
                      </div>
                    )}

                    <div className="h-px bg-rose-border/70" />

                    <div className="flex justify-between">
                      <span className="text-[22px] font-semibold text-navy">
                        Total
                      </span>
                      <span className="text-[24px] font-semibold leading-none text-rose-primary">
                        {formatPrice(estimatedTotal)}
                      </span>
                    </div>

                    <Link href="/checkout" className="block">
                      <Button className="h-auto w-full rounded-full py-4 text-base font-semibold">
                        <CreditCard className="mr-2 size-4" />
                        Proceed to Checkout
                      </Button>
                    </Link>

                    <Link href="/shop" className="block">
                      <Button
                        variant="outline"
                        className="h-auto w-full rounded-full border-rose-border py-4 text-base font-semibold text-rose-primary hover:bg-rose-50"
                      >
                        Continue Shopping
                      </Button>
                    </Link>

                    <div className="space-y-2 pt-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Truck className="size-4 text-rose-primary" />
                        Free shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD_GHS)}
                      </p>
                      <p className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-rose-primary" />
                        Secure checkout &amp; trusted payments
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </Container>

      {recommendations.length > 0 && (
        <Section className="bg-rose-light/50">
          <Container>
            <Heading
              as="h2"
              align="center"
              subtitle="Curated picks our customers love"
            >
              You May Also Like
            </Heading>
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
              {recommendations.map((product) => (
                <ShopStyleRecommendationCard key={product.id} product={product} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </main>
  )
}

function ShopStyleRecommendationCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))

  return (
    <div className="group overflow-hidden rounded-2xl border border-rose-border/20 bg-white transition-all duration-300 hover:border-rose-200 hover:shadow-[0_18px_38px_-18px_rgba(15,23,42,0.45)]">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative h-[330px] overflow-hidden bg-[#E9E7E3]">
          <img
            src={optimizedImageUrl(getProductPrimaryImageUrl(product), 320)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />

          <button
            onClick={(e) => {
              e.preventDefault()
              toggleItem(product)
            }}
            className={cn(
              "absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full bg-white/95 text-navy shadow-md transition-all hover:scale-105",
              isInWishlist && "text-rose-primary",
            )}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className="size-4" fill={isInWishlist ? "currentColor" : "none"} />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault()
                addItem(product)
              }}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-rose-primary shadow-xl"
            >
              <ShoppingBag className="size-4" />
              Add to Bag
            </button>
          </div>
        </div>
      </Link>

      <div className="bg-white px-5 pb-5 pt-4">
        <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-primary">
          {product.categoryName || "Category"}
        </span>
        <h3 className="mt-2 text-[17px] font-semibold leading-tight tracking-tight text-navy">
          {product.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[18px] font-semibold leading-none text-rose-primary">
            {formatPrice(product.salePrice ?? product.price)}
          </p>
          <Link
            href={`/products/${product.slug}`}
            className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-primary transition-colors hover:bg-rose-200"
            aria-label="View product"
          >
            <Eye className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
