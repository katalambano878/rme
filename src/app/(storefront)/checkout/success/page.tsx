"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Check, Loader2, AlertCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/lib/store/cart-store"
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

const primaryButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-7 text-base font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
const secondaryButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-brand bg-white px-7 text-base font-bold text-ink transition-colors hover:bg-counter disabled:cursor-not-allowed disabled:opacity-50"
const shell = "mx-auto max-w-[760px] px-4 pt-10 pb-20 sm:px-6 sm:pt-16"

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
    return <main className="min-h-[60vh]" />
  }

  // Visiting the page directly: there is no order to show, so don't invent one.
  if (!urlOrderNumber) {
    return (
      <main className="bg-white text-ink">
        <div className={shell}>
          <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
            No order to show
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-mute">
            This page appears after you complete checkout. Looking for an
            earlier order? Track it with your order number.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/shop" className={primaryButton}>
              Go to shop
            </Link>
            <Link href="/track-order" className={secondaryButton}>
              Track an order
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const orderNumber = urlOrderNumber
  const trackHref = `/track-order?order=${encodeURIComponent(orderNumber)}`

  if (verifyState === "verifying") {
    return (
      <main className="bg-white text-ink">
        <div className={shell} role="status" aria-live="polite">
          <Loader2 className="size-10 animate-spin text-raspberry motion-reduce:animate-none" aria-hidden />
          <h1 className="mt-5 text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] sm:text-[34px]">
            Confirming your payment…
          </h1>
          <p className="mt-3 text-[17px] text-mute">
            Order <span className="font-bold text-ink">{orderNumber}</span>. This
            usually takes a few seconds.
          </p>
        </div>
      </main>
    )
  }

  if (verifyState === "unconfirmed") {
    return (
      <main className="bg-white text-ink">
        <div className={shell}>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF4D6] px-3 py-1.5 text-sm font-bold text-[#6B4A00]">
            <AlertCircle className="size-4" aria-hidden />
            Waiting for payment
          </span>
          <h1 className="mt-4 text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
            Payment not confirmed yet
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-mute">
            We haven&apos;t received payment for order{" "}
            <span className="font-bold text-ink">{orderNumber}</span>. If you
            cancelled or the payment failed, you can try again — your bag is
            still saved. If money left your account, give it a minute and
            check again.
          </p>
          {retryError && (
            <p role="alert" className="mt-5 rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[15px] font-medium text-[#B42318]">
              {retryError}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={retryPayment} disabled={retrying} className={primaryButton}>
              {retrying && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              Retry payment
            </button>
            <button
              type="button"
              onClick={() => void verifyPayment()}
              disabled={retrying}
              className={secondaryButton}
            >
              Check again
            </button>
          </div>
          <Link
            href={trackHref}
            className="mt-6 inline-flex min-h-11 items-center text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
          >
            Track this order →
          </Link>
        </div>
      </main>
    )
  }

  const email = orderData?.formData.email?.trim()
  const shippingMethod = orderData?.formData.shippingMethod

  return (
    <main className="bg-white text-ink">
      <div className={shell}>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E2F4E8] px-3 py-1.5 text-sm font-bold text-[#1E6B3A]">
          <Check className="size-4" strokeWidth={3} aria-hidden />
          Payment confirmed
        </span>
        <h1 className="mt-4 text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          Thank you for your order!
        </h1>

        <div className="mt-6 flex flex-col gap-1 rounded-[18px] bg-blush p-5 sm:p-6">
          <p className="text-[15px] font-semibold text-ink">Order number</p>
          <p className="text-[26px] font-extrabold tracking-[-0.01em] tabular-nums break-all sm:text-[30px]">
            {orderNumber}
          </p>
          <p className="mt-1 text-[15px] text-ink">
            Save your order number to track your order.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-[22px] font-extrabold sm:text-2xl">What happens next</h2>
          <ol className="mt-4 flex flex-col gap-4">
            <li className="flex gap-3.5">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">1</span>
              <p className="pt-1 text-base leading-relaxed">
                {email ? (
                  <>
                    We&apos;ll send updates to{" "}
                    <span className="font-bold">{email}</span>
                  </>
                ) : (
                  <>
                    We&apos;ll reach you on the phone number you provided with
                    updates.
                  </>
                )}
              </p>
            </li>
            {shippingMethod === "pickup" && (
              <li className="flex gap-3.5">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">2</span>
                <p className="pt-1 text-base leading-relaxed">
                  Store pickup at Manet Ville Estates, East Airport Spintex, Accra.
                </p>
              </li>
            )}
            {shippingMethod === "delivery" && (
              <li className="flex gap-3.5">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">2</span>
                <p className="pt-1 text-base leading-relaxed">
                  Doorstep delivery: we will contact you with the delivery cost.
                </p>
              </li>
            )}
          </ol>
        </section>

        {orderData && (
          <section aria-label="Order details" className="mt-10 flex flex-col gap-4 rounded-[18px] bg-counter p-5 sm:p-6">
            <h2 className="text-xl font-extrabold">Order details</h2>

            <ul className="flex flex-col gap-3.5">
              {orderData.items.map((item) => {
                const price = item.product.salePrice ?? item.product.price
                const options = [item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")
                return (
                  <li
                    key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
                    className="flex items-center gap-3"
                  >
                    <div className="size-14 shrink-0 overflow-hidden rounded-[10px] bg-white">
                      <img
                        src={optimizedImageUrl(getProductPrimaryImageUrl(item.product), 112)}
                        alt=""
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-[15px] leading-[1.35]">
                      <p className="font-bold">{item.product.name}</p>
                      <p className="text-mute">
                        {options && `${options} · `}Qty {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-[15px] font-bold tabular-nums">
                      {formatPrice(price * item.quantity)}
                    </span>
                  </li>
                )
              })}
            </ul>

            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-t border-counter-deep pt-3.5 text-[15px] tabular-nums">
              <dt>Subtotal</dt>
              <dd className="text-right font-semibold">{formatPrice(orderData.subtotal)}</dd>
              <dt>Shipping</dt>
              <dd className="text-right text-mute">Confirmed by store</dd>
            </dl>
            <div className="flex items-baseline justify-between gap-3 border-t border-counter-deep pt-3.5">
              <span className="text-[17px] font-bold">Total</span>
              <span className="text-2xl font-extrabold tabular-nums">{formatPrice(orderData.total)}</span>
            </div>

            {orderData.formData.address1 && (
              <div className="border-t border-counter-deep pt-3.5 text-[15px] leading-relaxed">
                <p className="font-bold">
                  {orderData.formData.firstName} {orderData.formData.lastName}
                </p>
                <p className="text-mute">
                  {orderData.formData.address1}
                  <br />
                  {orderData.formData.city}, {orderData.formData.region}
                  <br />
                  {orderData.formData.country}
                </p>
              </div>
            )}
          </section>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={trackHref} className={primaryButton}>
            Track order
          </Link>
          <Link href="/" className={secondaryButton}>
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-raspberry motion-reduce:animate-none" aria-hidden />
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
