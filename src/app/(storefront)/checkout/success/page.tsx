"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, ShoppingBag, MapPin, ArrowRight, Loader2 } from "lucide-react"
import { formatPrice, generateOrderNumber } from "@/lib/utils"
import { Container } from "@/components/shared/container"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getProductPrimaryImageUrl } from "@/lib/product-image"

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

function ConfettiDots() {
  const dots = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 1.5,
        size: Math.random() * 6 + 3,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        drift: (Math.random() - 0.5) * 60,
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
            duration: 3.5 + Math.random() * 2,
            delay: dot.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const urlOrderNumber = searchParams.get("order") || ""
  const isPaymentSuccess = searchParams.get("payment_success") === "true"

  const [mounted, setMounted] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [paymentVerified, setPaymentVerified] = useState(false)
  const [fallbackOrderNumber] = useState(() => generateOrderNumber())

  useEffect(() => {
    setMounted(true)

    try {
      if (urlOrderNumber && isPaymentSuccess) {
        // Moolre redirect: move pendingOrder → lastOrder so display works
        const pending = sessionStorage.getItem("pendingOrder")
        if (pending) {
          sessionStorage.setItem("lastOrder", pending)
          sessionStorage.removeItem("pendingOrder")
        }
      }

      const data = sessionStorage.getItem("lastOrder")
      if (data) {
        setOrderData(JSON.parse(data))
        sessionStorage.removeItem("lastOrder")
      }
    } catch {}
  }, [urlOrderNumber, isPaymentSuccess])

  // Call verify endpoint when Moolre redirects back — fallback for when S2S callback is slow
  useEffect(() => {
    if (!mounted) return
    if (!urlOrderNumber || !isPaymentSuccess) return

    const orderNum = urlOrderNumber.trim()
    if (!/^ORD-/i.test(orderNum)) return

    setVerifying(true)

    fetch("/api/payment/moolre/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: orderNum }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.success || result.payment_status === "paid") {
          setPaymentVerified(true)
        }
      })
      .catch(() => {})
      .finally(() => setVerifying(false))
  }, [mounted, urlOrderNumber, isPaymentSuccess])

  if (!mounted) {
    return (
      <main className="min-h-[60vh]">
        <Container>
          <div className="py-20" />
        </Container>
      </main>
    )
  }

  const orderNumber = urlOrderNumber || orderData?.orderNumber || fallbackOrderNumber

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

            {verifying ? (
              <p className="mt-2 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Confirming your payment…
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">
                {orderData?.formData.email?.trim() ? (
                  <>
                    We&apos;ve sent a confirmation to{" "}
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
            )}

            {paymentVerified && (
              <p className="mt-2 text-sm font-medium text-emerald-600">
                Payment confirmed ✓
              </p>
            )}
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
                              src={getProductPrimaryImageUrl(item.product)}
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
                      <span
                        className={
                          orderData.shipping === 0
                            ? "text-emerald-600"
                            : "text-navy"
                        }
                      >
                        {orderData.shipping === 0
                          ? "Free"
                          : formatPrice(orderData.shipping)}
                      </span>
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
            <Link href={`/track-order?order=${orderNumber}`}>
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
