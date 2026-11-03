"use client"

import { useState, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, ShoppingBag, MapPin, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
import { Container } from "@/components/shared/container"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"

type OrderData = {
  orderNumber: string
  items: Array<{
    product: {
      id: string
      name: string
      slug: string
      price: number
      salePrice?: number
      images?: string[]
    }
    quantity: number
    selectedSize?: string
    selectedColor?: string
  }>
  subtotal: number
  shipping: number
  total: number
  formData: {
    email: string
    firstName: string
    lastName: string
    address1: string
    city: string
    region: string
    country: string
    shippingMethod: string
    paymentMethod: string
  }
}

const confettiColors = ["#E11D48", "#FB7185", "#F1D6DF", "#0B1B3A", "#FFF5F8"]

/** Deterministic 0..1 noise so render stays pure. */
function noise(i: number, k: number) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return v - Math.floor(v)
}

function ConfettiDots() {
  const dots = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: noise(i, 1) * 100,
        delay: noise(i, 2) * 1.5,
        size: noise(i, 3) * 6 + 3,
        color: confettiColors[Math.floor(noise(i, 4) * confettiColors.length)],
        drift: (noise(i, 5) - 0.5) * 60,
        duration: 3.5 + noise(i, 6) * 2,
      })),
    [],
  )

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            left: `${dot.x}%`,
            bottom: -10,
          }}
          animate={{
            y: -900,
            x: dot.drift,
            opacity: [0, 1, 1, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

type VerifyState = "verifying" | "paid" | "unconfirmed"

function readPendingOrder(orderNumber: string): OrderData | null {
  try {
    const raw = sessionStorage.getItem("pendingOrder")
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrderData
    return parsed?.orderNumber === orderNumber ? parsed : null
  } catch {
    return null
  }
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const urlOrderNumber = (searchParams.get("order") || "").trim()

  const [mounted, setMounted] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [verifyState, setVerifyState] = useState<VerifyState>("verifying")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState("")

  useEffect(() => {
    setMounted(true)
    if (urlOrderNumber) setOrderData(readPendingOrder(urlOrderNumber))
  }, [urlOrderNumber])

  const verifyPayment = useCallback(async () => {
    if (!urlOrderNumber || !/^ORD-/i.test(urlOrderNumber)) {
      setVerifyState("unconfirmed")
      return
    }
    setVerifyState("verifying")
    try {
      const res = await fetch("/api/payment/moolre/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: urlOrderNumber }),
      })
      const result = await res.json().catch(() => ({}))
      const paid = res.ok && (result?.success === true || result?.payment_status === "paid")

      if (paid) {
        // Only now is it safe to empty the bag and drop the pending summary.
        useCartStore.getState().clearCart()
        try {
          sessionStorage.removeItem("pendingOrder")
        } catch {}
        setVerifyState("paid")
      } else {
        setVerifyState("unconfirmed")
      }
    } catch {
      setVerifyState("unconfirmed")
    }
  }, [urlOrderNumber])

  useEffect(() => {
    if (!mounted || !urlOrderNumber) return
    void verifyPayment()
  }, [mounted, urlOrderNumber, verifyPayment])

  async function retryPayment() {
    setRetrying(true)
    setRetryError("")
    try {
      const res = await fetch("/api/payment/moolre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: urlOrderNumber,
          customerEmail: orderData?.formData.email?.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) {
        if (/already paid/i.test(data?.message || "")) {
          await verifyPayment()
          return
        }
        throw new Error(data?.message || "Couldn't start the payment. Please try again.")
      }
      window.location.href = data.url
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Couldn't start the payment. Please try again.")
    } finally {
      setRetrying(false)
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

  // Visiting the page directly: there is no order to show, so don't invent one.
  if (!urlOrderNumber) {
    return (
      <main className="pb-20">
        <Container>
          <div className="mx-auto max-w-xl pt-16 text-center sm:pt-24">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-rose-light">
              <ShoppingBag className="size-9 text-rose-primary" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
              No order to show
            </h1>
            <p className="mt-4 text-muted-foreground">
              This page appears after you complete checkout. Looking for an
              earlier order? Track it with your order number.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/shop">
                <Button className="h-auto rounded-full px-10 py-3.5 text-base font-semibold">
                  <ShoppingBag className="mr-2 size-4" />
                  Go to Shop
                </Button>
              </Link>
              <Link href="/track-order">
                <Button variant="outline" className="h-auto rounded-full px-10 py-3.5 text-base font-semibold">
                  Track an Order
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </main>
    )
  }

  const orderNumber = urlOrderNumber
  const trackHref = `/track-order?order=${encodeURIComponent(orderNumber)}`

  if (verifyState === "verifying") {
    return (
      <main className="min-h-[60vh]">
        <Container className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <Loader2 className="size-12 animate-spin text-rose-primary" />
          <h1 className="font-heading text-2xl font-semibold text-navy">
            Confirming your payment…
          </h1>
          <p className="text-muted-foreground">
            Order <span className="font-semibold text-navy">{orderNumber}</span>. This
            usually takes a few seconds.
          </p>
        </Container>
      </main>
    )
  }

  if (verifyState === "unconfirmed") {
    return (
      <main className="pb-20">
        <Container>
          <div className="mx-auto max-w-xl pt-16 text-center sm:pt-24">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-amber-50">
              <AlertCircle className="size-10 text-amber-500" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
              Payment not confirmed yet
            </h1>
            <p className="mt-4 text-muted-foreground">
              We haven&apos;t received payment for order{" "}
              <span className="font-semibold text-navy">{orderNumber}</span>. If you
              cancelled or the payment failed, you can try again — your bag is
              still saved. If money left your account, give it a minute and
              check again.
            </p>
            {retryError && (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {retryError}
              </p>
            )}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={retryPayment}
                disabled={retrying}
                className="h-auto rounded-full px-8 py-3.5 text-base font-semibold"
              >
                {retrying ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Retry payment
              </Button>
              <Button
                variant="outline"
                onClick={() => void verifyPayment()}
                disabled={retrying}
                className="h-auto rounded-full px-8 py-3.5 text-base font-semibold"
              >
                Check again
              </Button>
            </div>
            <Link
              href={trackHref}
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-rose-primary hover:underline"
            >
              Track this order
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  return (
    <main className="relative pb-20">
      <ConfettiDots />

      <Container>
        <div className="mx-auto max-w-2xl pt-16 text-center sm:pt-24">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 14,
              delay: 0.15,
            }}
            className="mx-auto mb-8 flex size-24 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/25 sm:size-28"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.3 }}
            >
              <Check className="size-12 text-white sm:size-14" strokeWidth={3} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl lg:text-5xl">
              Thank you for your order!
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Order{" "}
              <span className="font-semibold text-navy">{orderNumber}</span>
            </p>
            <p className="mt-2 text-sm font-medium text-emerald-600">
              Payment confirmed
            </p>
            <p className="mt-2 text-muted-foreground">
              {orderData?.formData.email?.trim() ? (
                <>
                  We&apos;ll send updates to{" "}
                  <span className="font-medium text-navy">
                    {orderData.formData.email.trim()}
                  </span>
                </>
              ) : (
                <>
                  Save your order number — we&apos;ll reach you on the phone
                  number you provided with updates.
                </>
              )}
            </p>
          </motion.div>

          {orderData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
              className="mt-10"
            >
              <Card className="luxury-shadow border-rose-border text-left">
                <CardContent className="space-y-5 p-6 sm:p-8">
                  <h3 className="font-heading text-base font-semibold text-navy">
                    Order Details
                  </h3>

                  <div className="space-y-3">
                    {orderData.items.map((item) => {
                      const price = item.product.salePrice ?? item.product.price
                      return (
                        <div
                          key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
                          className="flex items-center gap-3"
                        >
                          <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-rose-light">
                            <img
                              src={optimizedImageUrl(getProductPrimaryImageUrl(item.product), 96)}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-navy">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                              {item.selectedSize && ` · ${item.selectedSize}`}
                              {item.selectedColor && ` · ${item.selectedColor}`}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-navy">
                            {formatPrice(price * item.quantity)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <Separator className="bg-rose-border" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-navy">
                        {formatPrice(orderData.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-navy">Confirmed by store</span>
                    </div>
                    <Separator className="bg-rose-border" />
                    <div className="flex justify-between pt-1">
                      <span className="font-semibold text-navy">Total</span>
                      <span className="text-lg font-bold text-navy">
                        {formatPrice(orderData.total)}
                      </span>
                    </div>
                  </div>

                  {orderData.formData.address1 && (
                    <>
                      <Separator className="bg-rose-border" />
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="text-sm leading-relaxed text-navy">
                          <p className="font-medium">
                            {orderData.formData.firstName}{" "}
                            {orderData.formData.lastName}
                          </p>
                          <p className="text-muted-foreground">
                            {orderData.formData.address1}
                            <br />
                            {orderData.formData.city},{" "}
                            {orderData.formData.region}
                            <br />
                            {orderData.formData.country}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/">
              <Button className="h-auto rounded-full px-10 py-3.5 text-base font-semibold">
                <ShoppingBag className="mr-2 size-4" />
                Continue Shopping
              </Button>
            </Link>
            <Link href={trackHref}>
              <Button
                variant="outline"
                className="h-auto rounded-full px-10 py-3.5 text-base font-semibold"
              >
                Track Order
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </Container>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-rose-primary" />
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
