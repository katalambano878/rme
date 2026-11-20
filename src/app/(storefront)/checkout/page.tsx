"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ChevronDown, Smartphone } from "lucide-react"
import {
  cn,
  formatFreeShippingMinimumLabel,
  formatPrice,
} from "@/lib/utils"
import { WHATSAPP_URL } from "@/lib/brand"
import { useCartStore } from "@/lib/store/cart-store"
import { createClient } from "@/lib/supabase/client"
import { useStorePricing } from "@/components/store-pricing-provider"
import { liveLinePrice } from "@/lib/effective-price"
import {
  getProductPrimaryImageUrl,
  optimizedImageUrl,
} from "@/lib/product-image"
import type { Product } from "@/types/product"

type FormData = {
  email: string
  phone: string
  firstName: string
  lastName: string
  address1: string
  address2: string
  city: string
  region: string
  country: string
  postalCode: string
  saveForNextTime: boolean
  shippingMethod: string
  paymentMethod: string
  agreeToTerms: boolean
  couponCode: string
  orderNotes: string
}

const initialFormData: FormData = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  region: "",
  country: "Ghana",
  postalCode: "",
  saveForNextTime: false,
  shippingMethod: "",
  paymentMethod: "moolre",
  agreeToTerms: false,
  couponCode: "",
  orderNotes: "",
}

const paymentMethods = [
  {
    id: "moolre",
    name: "Mobile Money",
    description:
      "After you tap Pay, a secure Mobile Money page opens to approve the payment. Your order is confirmed once it goes through.",
  },
]

const shippingOptions = [
  {
    id: "pickup",
    name: "Store pickup · Free",
    detail: "Manet Ville Estates, East Airport Spintex, Accra.",
  },
  {
    id: "delivery",
    name: "Doorstep delivery",
    detail: `We will contact you with the delivery cost. Free over ${formatFreeShippingMinimumLabel()}.`,
  },
]

const ghanaRegions = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Eastern",
  "Northern",
  "Volta",
  "Upper East",
  "Upper West",
  "Brong-Ahafo",
  "Ahafo",
  "Bono",
  "Bono East",
  "North East",
  "Savannah",
  "Oti",
  "Western North",
]

/** JSON headers, plus the shopper's session when signed in so the order is linked to their account. */
async function checkoutHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  try {
    const { data } = await createClient().auth.getSession()
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  } catch {
    /* guest checkout */
  }
  return headers
}

/** `product.price` is the display price; it's the struck-through "was" when above the charge. */
function wasPriceFor(product: Product, effective: number): number | undefined {
  const was = Number(product.price)
  return Number.isFinite(was) && was > effective ? was : undefined
}

const inputClass =
  "min-h-[52px] w-full rounded-[10px] border border-field bg-white px-3.5 text-base font-normal text-ink placeholder:text-mute/70 transition-colors focus:border-ink focus:outline-none"
const errorInputClass = "border-[#B42318]"

function Field({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[15px] font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-mute"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[18px] bg-white p-5 sm:p-[26px]">
      <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  )
}

export default function CheckoutPage() {
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

  const items = useCartStore((s) => s.items)
  const storePricing = useStorePricing()
  useEffect(() => setMounted(true), [])

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

  const shippingCost = 0

  const total = subtotal + shippingCost

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const canProceedStep1 =
    formData.phone.trim() !== "" &&
    formData.firstName.trim() !== "" &&
    formData.lastName.trim() !== "" &&
    formData.address1.trim() !== "" &&
    formData.city.trim() !== "" &&
    formData.region.trim() !== ""

  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [step1Touched, setStep1Touched] = useState(false)

  const handlePlaceOrder = async () => {
    if (!formData.agreeToTerms) return
    setPlacingOrder(true)
    setOrderError("")

    try {
      const payload = {
        email: formData.email,
        phone: formData.phone,
        firstName: formData.firstName,
        lastName: formData.lastName,
        address1: formData.address1,
        address2: formData.address2,
        city: formData.city,
        region: formData.region,
        country: formData.country,
        postalCode: formData.postalCode,
        shippingMethod: formData.shippingMethod,
        orderNotes: formData.orderNotes || undefined,
        subtotal,
        shippingCost,
        total,
        items: items.map((item) => ({
          productId: item.product.id,
          variantId: null,
          name: item.product.name,
          sku: item.product.sku ?? "",
          price: liveLinePrice(item.product, storePricing),
          quantity: item.quantity,
          selectedSize: item.selectedSize || undefined,
          selectedColor: item.selectedColor || undefined,
        })),
      }

      if (formData.paymentMethod === "moolre") {
        const initRes = await fetch("/api/orders/create", {
          method: "POST",
          headers: await checkoutHeaders(),
          body: JSON.stringify(payload),
        })
        const initData = await initRes.json()

        if (!initRes.ok || !initData.order_id) {
          setOrderError(initData.error || "Failed to create order")
          setPlacingOrder(false)
          return
        }

        const moolreRes = await fetch("/api/payment/moolre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: initData.order_id,
            customerEmail: formData.email.trim() || undefined,
          }),
        })
        const moolreData = await moolreRes.json()

        if (!moolreRes.ok || !moolreData.success || !moolreData.url) {
          setOrderError(moolreData.message || "Failed to start mobile money payment")
          setPlacingOrder(false)
          return
        }

        sessionStorage.setItem(
          "pendingOrder",
          JSON.stringify({
            orderNumber: initData.order_number,
            items,
            subtotal,
            shipping: shippingCost,
            total,
            formData: {
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              address1: formData.address1,
              city: formData.city,
              region: formData.region,
              country: formData.country,
              shippingMethod: formData.shippingMethod,
              paymentMethod: formData.paymentMethod,
            },
          }),
        )

        // Keep the bag until the success page confirms payment (it clears
        // the cart once Moolre verifies the order as paid).
        window.location.href = moolreData.url
        return
      }

      // Every supported method redirects to a payment provider above; never
      // fall through to a success page with an invented order number.
      setOrderError("Please choose a payment method.")
    } catch (err) {
      console.error("Place order error:", err)
      setOrderError("Something went wrong. Please try again.")
    } finally {
      setPlacingOrder(false)
    }
  }

  // The old step gates (details, then shipping method, then terms) all run
  // here before the unchanged place-order call.
  const handlePay = () => {
    setStep1Touched(true)
    const missing = [
      ["firstName", formData.firstName.trim()],
      ["lastName", formData.lastName.trim()],
      ["phone", formData.phone.trim()],
      ["shippingMethod", formData.shippingMethod],
      ["address1", formData.address1.trim()],
      ["city", formData.city.trim()],
      ["region", formData.region.trim()],
    ].find(([, value]) => !value)
    if (missing) {
      const el = document.getElementById(
        missing[0] === "shippingMethod" ? "shipping-pickup" : missing[0],
      )
      el?.focus()
      return
    }
    if (!canProceedStep1 || !formData.shippingMethod) return
    void handlePlaceOrder()
  }

  const showError = (value: string) => step1Touched && !value.trim()
  const describedBy = (id: string, invalid: boolean, hint?: boolean) =>
    invalid ? `${id}-error` : hint ? `${id}-hint` : undefined

  if (!mounted) {
    return <main className="min-h-[60vh]" />
  }

  if (items.length === 0) {
    return (
      <main className="bg-white text-ink">
        <div className="mx-auto max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 lg:px-10">
          <div className="flex max-w-2xl flex-col items-start gap-3 rounded-2xl bg-counter p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold">Your bag is empty</h1>
            <p className="text-base text-mute">Add some items before checking out.</p>
            <Link
              href="/shop"
              className="mt-1 inline-flex min-h-[52px] items-center rounded-xl bg-brand px-6 text-base font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Shop essentials
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const payNote =
    formData.shippingMethod === "pickup"
      ? `You pay ${formatPrice(total)} now. Collect your order at Spintex.`
      : formData.shippingMethod === "delivery"
        ? `You pay ${formatPrice(total)} now. The store contacts you about the delivery fee.`
        : ""

  const summary = (
    <OrderSummaryContent
      items={items}
      subtotal={subtotal}
      savings={savings}
      shippingMethod={formData.shippingMethod}
      total={total}
    />
  )

  return (
    <main className="bg-counter text-ink">
      <div className="mx-auto max-w-[1200px] px-4 pt-5 pb-16 sm:px-6 lg:px-10">
        <Link
          href="/cart"
          className="inline-flex min-h-11 items-center text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
        >
          ← Back to bag
        </Link>

        <div className="mt-3 mb-5 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
            aria-expanded={mobileSummaryOpen}
            aria-controls="mobile-order-summary"
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[14px] bg-white px-5 py-3 text-left"
          >
            <span className="text-[15px] font-bold">
              Your order ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-extrabold tabular-nums">{formatPrice(total)}</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-5 text-mute transition-transform duration-200 motion-reduce:transition-none",
                  mobileSummaryOpen && "rotate-180",
                )}
              />
            </span>
          </button>
          {mobileSummaryOpen && (
            <div id="mobile-order-summary" className="mt-2 rounded-[18px] bg-white p-5">
              {summary}
            </div>
          )}
        </div>

        <div className="grid items-start gap-6 lg:mt-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (formData.agreeToTerms && !placingOrder) handlePay()
            }}
            className="flex min-w-0 flex-col gap-5"
          >
            <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[40px]">
              Checkout
            </h1>

            <Section title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="firstName" label="First name" error={showError(formData.firstName) ? "First name is required" : undefined}>
                  <input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.firstName) || undefined}
                    aria-describedby={describedBy("firstName", showError(formData.firstName))}
                    className={cn(inputClass, showError(formData.firstName) && errorInputClass)}
                  />
                </Field>
                <Field id="lastName" label="Last name" error={showError(formData.lastName) ? "Last name is required" : undefined}>
                  <input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.lastName) || undefined}
                    aria-describedby={describedBy("lastName", showError(formData.lastName))}
                    className={cn(inputClass, showError(formData.lastName) && errorInputClass)}
                  />
                </Field>
                <Field
                  id="phone"
                  label="Phone number"
                  hint="We'll reach you on this number with order updates."
                  error={showError(formData.phone) ? "Phone number is required" : undefined}
                >
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="059 270 7791"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.phone) || undefined}
                    aria-describedby={describedBy("phone", showError(formData.phone), true)}
                    className={cn(inputClass, showError(formData.phone) && errorInputClass)}
                  />
                </Field>
                <Field id="email" label="Email" optional>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Delivery">
              <div
                role="radiogroup"
                aria-label="How would you like to get your order?"
                aria-describedby={step1Touched && !formData.shippingMethod ? "shipping-error" : undefined}
                className="grid gap-3 sm:grid-cols-2"
              >
                {shippingOptions.map((option) => {
                  const selected = formData.shippingMethod === option.id
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-[14px] p-[18px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-raspberry",
                        selected
                          ? "border-2 border-brand bg-blush"
                          : "border border-line bg-white hover:border-field",
                      )}
                    >
                      <input
                        id={`shipping-${option.id}`}
                        type="radio"
                        name="shippingMethod"
                        value={option.id}
                        checked={selected}
                        onChange={() => updateField("shippingMethod", option.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-brand"
                      >
                        <span className={cn("size-2.5 rounded-full", selected ? "bg-brand" : "bg-transparent")} />
                      </span>
                      <span className="flex flex-col gap-1">
                        <strong className="text-base font-bold">{option.name}</strong>
                        <span className={cn("text-sm leading-[1.45]", selected ? "text-ink/80" : "text-mute")}>
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {step1Touched && !formData.shippingMethod && (
                <p id="shipping-error" className="text-sm font-medium text-[#B42318]">
                  Choose store pickup or doorstep delivery
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="address1"
                  label="Street address / delivery address"
                  className="sm:col-span-2"
                  error={showError(formData.address1) ? "Delivery address is required" : undefined}
                >
                  <input
                    id="address1"
                    type="text"
                    autoComplete="street-address"
                    placeholder="e.g. 111 Newtown Rd, Accra Newtown"
                    value={formData.address1}
                    onChange={(e) => updateField("address1", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.address1) || undefined}
                    aria-describedby={describedBy("address1", showError(formData.address1))}
                    className={cn(inputClass, showError(formData.address1) && errorInputClass)}
                  />
                </Field>
                <Field id="city" label="City" error={showError(formData.city) ? "City is required" : undefined}>
                  <input
                    id="city"
                    type="text"
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.city) || undefined}
                    aria-describedby={describedBy("city", showError(formData.city))}
                    className={cn(inputClass, showError(formData.city) && errorInputClass)}
                  />
                </Field>
                <Field id="region" label="Region" error={showError(formData.region) ? "Please select your region" : undefined}>
                  <select
                    id="region"
                    autoComplete="address-level1"
                    value={formData.region}
                    onChange={(e) => updateField("region", e.target.value)}
                    aria-required
                    aria-invalid={showError(formData.region) || undefined}
                    aria-describedby={describedBy("region", showError(formData.region))}
                    className={cn(inputClass, "px-3", !formData.region && "text-mute", showError(formData.region) && errorInputClass)}
                  >
                    <option value="" disabled>
                      Select region
                    </option>
                    {ghanaRegions.map((r) => (
                      <option key={r} value={r} className="text-ink">
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="orderNotes" label="Order notes" optional className="sm:col-span-2">
                  <textarea
                    id="orderNotes"
                    rows={3}
                    placeholder="Any special instructions, delivery notes, or requests for your order…"
                    value={formData.orderNotes}
                    onChange={(e) => updateField("orderNotes", e.target.value)}
                    className={cn(inputClass, "resize-none py-3 leading-normal")}
                  />
                </Field>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input
                  type="checkbox"
                  checked={formData.saveForNextTime}
                  onChange={(e) => updateField("saveForNextTime", e.target.checked)}
                  className="size-5 shrink-0 accent-raspberry"
                />
                Save this address for future orders
              </label>
            </Section>

            <Section title="Payment">
              <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-3">
                {paymentMethods.map((method) => {
                  const selected = formData.paymentMethod === method.id
                  return (
                    <label
                      key={method.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3.5 rounded-[14px] p-[18px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-raspberry",
                        selected ? "border-2 border-brand bg-blush" : "border border-line bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={selected}
                        onChange={() => updateField("paymentMethod", method.id)}
                        className="sr-only"
                      />
                      <Smartphone className="size-[26px] shrink-0 text-raspberry" aria-hidden />
                      <span className="flex flex-col gap-1">
                        <strong className="text-base font-bold">{method.name}</strong>
                        <span className="text-sm leading-[1.45] text-ink/80">{method.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[15px] leading-[1.45]">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => updateField("agreeToTerms", e.target.checked)}
                  className="mt-px size-5 shrink-0 accent-raspberry"
                />
                <span>
                  I agree to the{" "}
                  <Link
                    href="/policies/terms"
                    target="_blank"
                    className="font-semibold text-raspberry underline underline-offset-2 hover:text-raspberry-deep"
                  >
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/policies/privacy"
                    target="_blank"
                    className="font-semibold text-raspberry underline underline-offset-2 hover:text-raspberry-deep"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {orderError && (
                <p role="alert" className="rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[15px] font-medium text-[#B42318]">
                  {orderError}
                </p>
              )}

              <button
                type="submit"
                disabled={!formData.agreeToTerms || placingOrder}
                className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-center text-[17px] font-extrabold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-45 sm:text-lg"
              >
                {placingOrder ? (
                  <>
                    <span
                      aria-hidden
                      className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                    />
                    Processing…
                  </>
                ) : (
                  <>Pay {formatPrice(total)} with Mobile Money</>
                )}
              </button>
              {!formData.agreeToTerms && (
                <p className="text-center text-sm text-mute">
                  Tick the box above to agree to the terms before you pay.
                </p>
              )}
              {formData.agreeToTerms && payNote && (
                <p className="text-center text-sm text-mute">{payNote}</p>
              )}
            </Section>
          </form>

          <aside
            aria-label="Order summary"
            className="hidden flex-col gap-4 rounded-[18px] bg-white p-6 lg:sticky lg:top-6 lg:flex"
          >
            <h2 className="text-xl font-extrabold">Your order</h2>
            {summary}
          </aside>
        </div>
      </div>
    </main>
  )
}

function OrderSummaryContent({
  items,
  subtotal,
  savings,
  shippingMethod,
  total,
}: {
  items: ReturnType<typeof useCartStore.getState>["items"]
  subtotal: number
  savings: number
  shippingMethod: string
  total: number
}) {
  const storePricing = useStorePricing()

  return (
    <div className="flex flex-col gap-4 text-ink">
      <ul className="flex max-h-72 flex-col gap-3.5 overflow-y-auto">
        {items.map((item) => {
          const price = liveLinePrice(item.product, storePricing)
          const options = [item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")
          return (
            <li
              key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
              className="flex items-center gap-3"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-[10px] bg-counter">
                <img
                  src={optimizedImageUrl(getProductPrimaryImageUrl(item.product), 160)}
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

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2.5 border-t border-line pt-3.5 text-[15px] tabular-nums">
        <dt>Items</dt>
        <dd className="text-right font-semibold">{formatPrice(subtotal)}</dd>
        {savings > 0 && (
          <>
            <dt className="text-[#1E6B3A]">You save</dt>
            <dd className="text-right font-bold text-[#1E6B3A]">{formatPrice(savings)}</dd>
          </>
        )}
        <dt>{shippingMethod === "pickup" ? "Store pickup" : "Delivery"}</dt>
        <dd className="text-right text-mute">
          {shippingMethod === "pickup"
            ? "Free"
            : shippingMethod === "delivery"
              ? "Confirmed by store"
              : "Choose above"}
        </dd>
      </dl>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3.5">
        <span className="text-[17px] font-bold">Total</span>
        <span className="text-[26px] font-extrabold tabular-nums sm:text-[28px]">{formatPrice(total)}</span>
      </div>

      <p className="text-sm leading-normal text-mute">
        Questions before you pay?{" "}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-raspberry hover:text-raspberry-deep"
        >
          Ask us on WhatsApp
        </a>
      </p>
    </div>
  )
}
