"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Truck,

  CreditCard,
  Package,
  MessageCircle,
} from "lucide-react"
import {
  cn,
  formatPrice,
  generateOrderNumber,
} from "@/lib/utils"
import { Container } from "@/components/shared/container"
import { useCartStore } from "@/lib/store/cart-store"
import { getProductPrimaryImageUrl } from "@/lib/product-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  paymentMethod: "paystack",
  agreeToTerms: false,
  couponCode: "",
  orderNotes: "",
}

const steps = [
  { id: 1, name: "Details" },
  { id: 2, name: "Shipping" },
  { id: 3, name: "Payment" },
  { id: 4, name: "Review" },
]

const paymentMethods = [
  {
    id: "paystack",
    name: "Card Payment",
    description: "Debit & credit cards, bank transfer & more (via Paystack)",
    recommended: true,
  },
  {
    id: "moolre",
    name: "Mobile Money",
    description: "Pay with mobile money from your network",
    recommended: false,
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

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2">
            <motion.div
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300 sm:size-10",
                step.id < currentStep && "bg-navy text-white",
                step.id === currentStep &&
                  "bg-rose-100 text-navy shadow-lg shadow-rose-200/40",
                step.id > currentStep &&
                  "border-2 border-gray-300 text-gray-400",
              )}
              animate={
                step.id === currentStep ? { scale: [0.95, 1] } : { scale: 1 }
              }
              transition={{ duration: 0.3 }}
            >
              {step.id < currentStep ? (
                <Check className="size-4" />
              ) : (
                step.id
              )}
            </motion.div>
            <span
              className={cn(
                "text-[11px] font-medium sm:text-xs",
                step.id <= currentStep
                  ? "text-navy"
                  : "text-gray-400",
              )}
            >
              {step.name}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "-mt-5 mx-1.5 h-0.5 w-8 sm:mx-3 sm:w-16",
                step.id < currentStep ? "bg-navy" : "bg-gray-200",
              )}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[17px] font-semibold text-navy">
        {label}
        {required && <span className="ml-0.5 text-rose-primary">*</span>}
      </Label>
      {children}
    </div>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [couponApplied, setCouponApplied] = useState(false)

  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  useEffect(() => setMounted(true), [])

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

  const shippingCost = 0

  const total = subtotal + shippingCost

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleApplyCoupon = () => {
    setCouponApplied(formData.couponCode.trim().toUpperCase() === "WELCOME10")
  }

  const fieldClass =
    "h-14 rounded-2xl border-2 border-rose-100 bg-white text-base text-navy placeholder:text-gray-400 focus-visible:border-rose-200 focus-visible:ring-0"

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
          price: item.product.salePrice ?? item.product.price,
          quantity: item.quantity,
          selectedSize: item.selectedSize || undefined,
          selectedColor: item.selectedColor || undefined,
        })),
      }

      if (formData.paymentMethod === "paystack") {
        const res = await fetch("/api/paystack/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()

        if (!res.ok || !data.authorization_url) {
          setOrderError(data.error || "Failed to initialize payment")
          setPlacingOrder(false)
          return
        }

        sessionStorage.setItem(
          "pendingOrder",
          JSON.stringify({
            orderNumber: data.order_number,
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

        clearCart()
        window.location.href = data.authorization_url
        return
      }

      if (formData.paymentMethod === "moolre") {
        const initRes = await fetch("/api/paystack/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, paymentProvider: "moolre" }),
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

        clearCart()
        window.location.href = moolreData.url
        return
      }

      sessionStorage.setItem(
        "lastOrder",
        JSON.stringify({
          orderNumber: generateOrderNumber(),
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
      clearCart()
      router.push("/checkout/success")
    } catch (err) {
      console.error("Place order error:", err)
      setOrderError("Something went wrong. Please try again.")
    } finally {
      setPlacingOrder(false)
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

  if (items.length === 0) {
    return (
      <main>
        <Container>
          <div className="flex flex-col items-center justify-center py-32">
            <Package className="size-16 text-rose-primary/30" />
            <h2 className="mt-6 font-heading text-2xl font-semibold text-navy">
              Your bag is empty
            </h2>
            <p className="mt-2 text-muted-foreground">
              Add some items before checking out
            </p>
            <Link href="/" className="mt-8">
              <Button className="h-auto rounded-full bg-rose-100 px-10 py-3.5 text-base font-semibold text-navy hover:bg-rose-200">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  return (
    <main className="pb-12">
      <Container>
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-4"
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
            <li>
              <Link
                href="/cart"
                className="transition-colors hover:text-rose-primary"
              >
                Your Bag
              </Link>
            </li>
            <li>
              <ChevronRight className="size-3.5" />
            </li>
            <li className="font-medium text-navy">Checkout</li>
          </ol>
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7"
        >
          <StepIndicator currentStep={step} />
        </motion.div>

        <div className="mb-8 lg:hidden">
          <button
            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-border bg-rose-light/50 px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-rose-primary" />
              <span className="text-sm font-medium text-navy">
                Order Summary ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-navy">
                {formatPrice(total)}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  mobileSummaryOpen && "rotate-180",
                )}
              />
            </div>
          </button>
          <AnimatePresence>
            {mobileSummaryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-1 pt-4">
                  <OrderSummaryContent
                    items={items}
                    subtotal={subtotal}
                    shippingCost={shippingCost}
                    shippingMethod={formData.shippingMethod}
                    total={total}
                    couponCode={formData.couponCode}
                    onCouponChange={(val) => updateField("couponCode", val)}
                    onApplyCoupon={handleApplyCoupon}
                    couponApplied={couponApplied}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid gap-7 lg:grid-cols-[1fr_360px] lg:gap-8">
          <div>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepWrapper key="details">
                  <h2 className="mb-6 font-heading text-2xl font-semibold text-navy">
                    Your Details
                  </h2>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="First Name" required>
                        <Input
                          placeholder="First name"
                          value={formData.firstName}
                          onChange={(e) =>
                            updateField("firstName", e.target.value)
                          }
                          className={cn(fieldClass, step1Touched && !formData.firstName.trim() && "border-red-400")}
                        />
                        {step1Touched && !formData.firstName.trim() && (
                          <p className="text-xs text-red-500 mt-1">First name is required</p>
                        )}
                      </FormField>
                      <FormField label="Last Name" required>
                        <Input
                          placeholder="Last name"
                          value={formData.lastName}
                          onChange={(e) =>
                            updateField("lastName", e.target.value)
                          }
                          className={cn(fieldClass, step1Touched && !formData.lastName.trim() && "border-red-400")}
                        />
                        {step1Touched && !formData.lastName.trim() && (
                          <p className="text-xs text-red-500 mt-1">Last name is required</p>
                        )}
                      </FormField>
                    </div>

                    <FormField label="Email Address (optional)">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) =>
                          updateField("email", e.target.value)
                        }
                        className={fieldClass}
                      />
                    </FormField>

                    <FormField label="Phone Number" required>
                      <Input
                        type="tel"
                        placeholder="Your phone number"
                        value={formData.phone}
                        onChange={(e) =>
                          updateField("phone", e.target.value)
                        }
                        className={cn(fieldClass, step1Touched && !formData.phone.trim() && "border-red-400")}
                      />
                      {step1Touched && !formData.phone.trim() && (
                        <p className="text-xs text-red-500 mt-1">Phone number is required</p>
                      )}
                    </FormField>

                    <FormField label="Street Address / Delivery Address" required>
                      <Input
                        placeholder="e.g. 123 Main Street, City"
                        value={formData.address1}
                        onChange={(e) =>
                          updateField("address1", e.target.value)
                        }
                        className={cn(fieldClass, step1Touched && !formData.address1.trim() && "border-red-400")}
                      />
                      {step1Touched && !formData.address1.trim() && (
                        <p className="text-xs text-red-500 mt-1">Delivery address is required</p>
                      )}
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="City" required>
                        <Input
                          placeholder="City"
                          value={formData.city}
                          onChange={(e) =>
                            updateField("city", e.target.value)
                          }
                          className={cn(fieldClass, step1Touched && !formData.city.trim() && "border-red-400")}
                        />
                        {step1Touched && !formData.city.trim() && (
                          <p className="text-xs text-red-500 mt-1">City is required</p>
                        )}
                      </FormField>
                      <FormField label="Region" required>
                        <Select
                          value={formData.region}
                          onValueChange={(val) =>
                            updateField("region", val as string)
                          }
                        >
                          <SelectTrigger className={cn("w-full", fieldClass, step1Touched && !formData.region && "border-red-400")}>
                            <SelectValue placeholder="Select Region" />
                          </SelectTrigger>
                          <SelectContent>
                            {ghanaRegions.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {step1Touched && !formData.region && (
                          <p className="text-xs text-red-500 mt-1">Please select your region</p>
                        )}
                      </FormField>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        checked={formData.saveForNextTime}
                        onCheckedChange={(checked) =>
                          updateField("saveForNextTime", checked as boolean)
                        }
                      />
                      <Label className="cursor-pointer text-sm text-muted-foreground">
                        Save this address for future orders
                      </Label>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <Label htmlFor="orderNotes" className="text-sm font-medium">
                      Order Notes <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <textarea
                      id="orderNotes"
                      rows={3}
                      placeholder="Any special instructions, delivery notes, or requests for your order…"
                      value={formData.orderNotes}
                      onChange={(e) => updateField("orderNotes", e.target.value)}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
                  </div>

                  <div className="mt-7 flex justify-end">
                    <Button
                      onClick={() => {
                        setStep1Touched(true)
                        if (canProceedStep1) setStep(2)
                      }}
                      className="h-auto rounded-full bg-rose-200 px-9 py-4 text-base font-semibold text-rose-800 hover:bg-rose-300"
                    >
                      Continue to Shipping
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 2 && (
                <StepWrapper key="shipping">
                  <h2 className="mb-5 font-heading text-2xl font-semibold text-navy">
                    Shipping Method
                  </h2>

                  <RadioGroup
                    value={formData.shippingMethod}
                    onValueChange={(val) =>
                      updateField("shippingMethod", val as string)
                    }
                    className="space-y-3"
                  >
                    {[
                      {
                        id: "pickup",
                        name: "Store Pickup",
                        estimate: "Store pickup address TBD",
                        price: 0,
                        icon: Package,
                      },
                      {
                        id: "delivery",
                        name: "Doorstep Delivery",
                        estimate: "We will contact you with the delivery cost",
                        price: -1,
                        icon: Truck,
                      },
                    ].map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all",
                          formData.shippingMethod === option.id
                            ? "border-rose-300 bg-rose-light/50"
                            : "border-rose-border hover:border-rose-300/50",
                        )}
                      >
                        <RadioGroupItem value={option.id} />
                        <option.icon className="size-5 shrink-0 text-navy" />
                        <div className="flex-1">
                          <p className="font-medium text-navy">{option.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {option.estimate}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            option.price === 0
                              ? "text-emerald-600"
                              : "text-amber-600",
                          )}
                        >
                          {option.price === 0
                            ? "Free"
                            : "At a Cost"}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>


                  <div className="mt-7 flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="h-auto gap-2 px-5 py-3"
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={() => formData.shippingMethod && setStep(3)}
                      disabled={!formData.shippingMethod}
                      className="h-auto rounded-full bg-rose-100 px-8 py-3 text-sm font-semibold text-navy hover:bg-rose-200"
                    >
                      Continue to Payment
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 3 && (
                <StepWrapper key="payment">
                  <h2 className="mb-5 font-heading text-2xl font-semibold text-navy">
                    Payment Method
                  </h2>

                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={(val) =>
                      updateField("paymentMethod", val as string)
                    }
                    className="space-y-3"
                  >
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all",
                          formData.paymentMethod === method.id
                            ? "border-rose-300 bg-rose-light/50"
                            : "border-rose-border hover:border-rose-300/50",
                        )}
                      >
                        <RadioGroupItem value={method.id} className="mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="size-4 text-navy" />
                            <p className="font-medium text-navy">
                              {method.name}
                            </p>
                            {method.recommended && (
                              <span className="rounded-full bg-rose-200/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {method.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>

                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    You&apos;ll be redirected to{" "}
                    <span className="font-medium text-navy">
                      {
                        paymentMethods.find(
                          (m) => m.id === formData.paymentMethod,
                        )?.name
                      }
                    </span>{" "}
                    to complete payment
                  </p>

                  <div className="mt-7 flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setStep(2)}
                      className="h-auto gap-2 px-5 py-3"
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep(4)}
                      className="h-auto rounded-full bg-rose-100 px-8 py-3 text-sm font-semibold text-navy hover:bg-rose-200"
                    >
                      Review Order
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 4 && (
                <StepWrapper key="review">
                  <h2 className="mb-5 font-heading text-2xl font-semibold text-navy">
                    Review Your Order
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Items ({itemCount})
                      </h3>
                      <div className="space-y-4">
                        {items.map((item) => {
                          const price =
                            item.product.salePrice ?? item.product.price
                          return (
                            <div
                              key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
                              className="flex items-center gap-4"
                            >
                              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-rose-light">
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
                                  {item.selectedSize &&
                                    ` · ${item.selectedSize}`}
                                  {item.selectedColor &&
                                    ` · ${item.selectedColor}`}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-navy">
                                {formatPrice(price * item.quantity)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <Separator className="bg-rose-border" />

                    <div>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Shipping Address
                      </h3>
                      <p className="text-sm leading-relaxed text-navy">
                        {formData.firstName} {formData.lastName}
                        <br />
                        {formData.address1}
                        {formData.address2 && (
                          <>
                            <br />
                            {formData.address2}
                          </>
                        )}
                        <br />
                        {formData.city}, {formData.region}
                        <br />
                        {formData.country}
                        {formData.postalCode && ` · ${formData.postalCode}`}
                      </p>
                    </div>

                    <Separator className="bg-rose-border" />

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Shipping Method
                        </h3>
                        <p className="text-sm text-navy">
                          {formData.shippingMethod === "pickup"
                            ? "Store Pickup"
                            : "Doorstep Delivery"}
                        </p>
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Payment
                        </h3>
                        <p className="text-sm text-navy">
                          {
                            paymentMethods.find(
                              (m) => m.id === formData.paymentMethod,
                            )?.name
                          }
                        </p>
                      </div>
                    </div>

                    {formData.orderNotes && (
                      <>
                        <Separator className="bg-rose-border" />
                        <div>
                          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Order Notes
                          </h3>
                          <p className="text-sm text-navy">{formData.orderNotes}</p>
                        </div>
                      </>
                    )}

                    <Separator className="bg-rose-border" />

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-navy">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span
                          className={cn(
                            "font-medium",
                            shippingCost === 0
                              ? "text-emerald-600"
                              : "text-navy",
                          )}
                        >
                          {shippingCost === 0
                            ? "Free"
                            : formatPrice(shippingCost)}
                        </span>
                      </div>
                      <Separator className="bg-rose-border" />
                      <div className="flex justify-between pt-1">
                        <span className="text-base font-semibold text-navy">
                          Total
                        </span>
                        <span className="text-lg font-bold text-navy">
                          {formatPrice(total)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={formData.agreeToTerms}
                        onCheckedChange={(checked) =>
                          updateField("agreeToTerms", checked as boolean)
                        }
                      />
                      <Label className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
                        I agree to the{" "}
                        <Link
                          href="#"
                          className="font-medium text-navy underline underline-offset-2"
                        >
                          Terms & Conditions
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="#"
                          className="font-medium text-navy underline underline-offset-2"
                        >
                          Privacy Policy
                        </Link>
                      </Label>
                    </div>
                  </div>

                  {orderError && (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {orderError}
                    </p>
                  )}

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setStep(3)}
                      className="h-auto gap-2 px-5 py-3"
                      disabled={placingOrder}
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={!formData.agreeToTerms || placingOrder}
                      className="h-auto rounded-full bg-rose-100 px-10 py-3.5 text-base font-semibold text-navy hover:bg-rose-200"
                    >
                      {placingOrder ? (
                        <>
                          <span className="mr-2 size-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 size-5" />
                          Place Order
                        </>
                      )}
                    </Button>
                  </div>
                </StepWrapper>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              <Card className="overflow-visible rounded-[2rem] border border-rose-border/60 bg-rose-100 text-navy shadow-[0_22px_50px_-25px_rgba(15,23,42,0.12)]">
                <CardContent className="p-5">
                  <h3 className="mb-4 font-heading text-2xl font-semibold text-navy">
                    Order Summary
                  </h3>
                  <OrderSummaryContent
                    items={items}
                    subtotal={subtotal}
                    shippingCost={shippingCost}
                    shippingMethod={formData.shippingMethod}
                    total={total}
                    couponCode={formData.couponCode}
                    onCouponChange={(val) => updateField("couponCode", val)}
                    onApplyCoupon={handleApplyCoupon}
                    couponApplied={couponApplied}
                  />
                </CardContent>
              </Card>
              <Card className="border-rose-border/80">
                <CardContent className="flex items-start gap-3 p-4">
                  <MessageCircle className="mt-0.5 size-4 text-rose-primary" />
                  <div>
                    <p className="text-sm font-semibold text-navy">Need help?</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Our concierge can help with shipping, payment, and fit before you place your order.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </main>
  )
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
      className="rounded-[2rem] border border-rose-border/40 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] sm:p-8"
    >
      {children}
    </motion.div>
  )
}

function OrderSummaryContent({
  items,
  subtotal,
  shippingCost,
  shippingMethod,
  total,
  couponCode,
  onCouponChange,
  onApplyCoupon,
  couponApplied,
}: {
  items: ReturnType<typeof useCartStore.getState>["items"]
  subtotal: number
  shippingCost: number
  shippingMethod: string
  total: number
  couponCode: string
  onCouponChange: (value: string) => void
  onApplyCoupon: () => void
  couponApplied: boolean
}) {
  const tax = 0

  return (
    <div className="space-y-5 text-navy">
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {items.map((item) => {
          const price = item.product.salePrice ?? item.product.price
          return (
            <div
              key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
              className="flex items-center gap-3"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/80">
                <img
                  src={getProductPrimaryImageUrl(item.product)}
                  alt=""
                  className="size-full object-cover"
                />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-rose-200 text-[10px] font-bold text-navy">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">
                  {item.product.name}
                </p>
                {(item.selectedSize || item.selectedColor) && (
                  <p className="text-[11px] text-navy/70">
                    {item.selectedSize}
                    {item.selectedSize && item.selectedColor && " · "}
                    {item.selectedColor}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold text-navy">
                {formatPrice(price * item.quantity)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="h-px bg-navy/10" />

      <div>
        <p className="mb-2 text-sm font-semibold">Coupon Code</p>
        <div className="flex overflow-hidden rounded-xl border border-rose-border bg-white">
          <Input
            value={couponCode}
            onChange={(e) => onCouponChange(e.target.value)}
            placeholder="Enter coupon code"
            className="h-11 border-0 bg-transparent text-base text-navy placeholder:text-navy/45 focus-visible:ring-0"
            onKeyDown={(e) => e.key === "Enter" && onApplyCoupon()}
          />
          <button
            type="button"
            onClick={onApplyCoupon}
            className="px-4 text-base font-semibold text-navy hover:bg-rose-50"
          >
            Apply
          </button>
        </div>
        {couponApplied ? (
          <p className="mt-2 text-xs text-navy/75">Coupon applied: WELCOME10</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[15px]">
          <span className="text-navy/75">Subtotal</span>
          <span className="font-semibold text-navy">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[15px]">
          <span className="text-navy/75">Shipping</span>
          <span className="font-semibold text-navy">
            {!shippingMethod ? "—" : shippingMethod === "delivery" ? "TBD" : "Free"}
          </span>
        </div>
        <div className="flex justify-between text-[15px]">
          <span className="text-navy/75">Tax</span>
          <span className="font-semibold text-navy">{formatPrice(tax)}</span>
        </div>
      </div>

      <div className="h-px bg-navy/10" />

      <div className="flex justify-between">
        <span className="text-2xl font-semibold text-navy">Total</span>
        <span className="text-2xl font-semibold leading-none text-navy">
          {formatPrice(total)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1 text-sm font-semibold text-navy/85">
        <ShieldCheck className="size-4" />
        <span>Secure Checkout</span>
      </div>
    </div>
  )
}
