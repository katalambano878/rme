"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Package,
  CheckCircle2,
  Truck,
  ClipboardCheck,
  Box,
  Loader2,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STATUS_STEPS = [
  { key: "pending",          label: "Order Placed", description: "Your order has been received.", icon: ClipboardCheck },
  { key: "processing",       label: "Processing",   description: "Items are being prepared and quality-checked.", icon: Box },
  { key: "shipped",          label: "Packaged",     description: "Your order has been packaged and is ready to go.", icon: Package },
  { key: "out_for_delivery", label: "With Rider",   description: "Your package is with a rider and on its way to you.", icon: Truck },
  { key: "delivered",        label: "Delivered",    description: "Your order has been successfully delivered.", icon: CheckCircle2 },
]

const ORDER_STATUS_INDEX: Record<string, number> = {
  pending: 0,
  paid: 1,
  processing: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
}

/** Statuses that end the normal journey — shown instead of the timeline. */
const TERMINAL_STATES: Record<
  string,
  { label: string; description: string; icon: typeof XCircle; tone: string }
> = {
  cancelled: {
    label: "Order Cancelled",
    description: "This order was cancelled. If you were charged, contact us and we'll sort it out.",
    icon: XCircle,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  refunded: {
    label: "Order Refunded",
    description: "This order has been refunded. Refunds can take a few days to reach your account.",
    icon: RotateCcw,
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  failed: {
    label: "Payment Failed",
    description: "We didn't receive payment for this order. You can place it again or contact us for help.",
    icon: AlertTriangle,
    tone: "border-red-200 bg-red-50 text-red-700",
  },
}

type TrackedOrder = {
  order_number: string
  status: string
  grand_total: number
  created_at: string
  is_paid: boolean
  items: { id: string; name: string; sku: string | null; quantity: number; unit_price: number }[]
}

function TrackOrderContent() {
  const searchParams = useSearchParams()
  const urlOrder = searchParams.get("order") || ""

  const [orderNumber, setOrderNumber] = useState(urlOrder)
  const [contact, setContact]         = useState("")
  const [order, setOrder]             = useState<TrackedOrder | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState("")
  const [searched, setSearched]       = useState(false)

  // Lookup goes through a server API route. Querying the orders table
  // directly from the browser never worked for guests: RLS only lets the
  // logged-in owner or staff read orders, so anonymous visitors always got
  // "Order not found". The server route verifies the email and returns a
  // safe subset of the order. Either the order email or phone is accepted.
  const fetchOrder = useCallback(async (orderNum: string, contactVal: string) => {
    if (!contactVal.trim()) {
      setError("Please enter the email or phone number you used at checkout.")
      return
    }
    setLoading(true)
    setError("")
    setOrder(null)

    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNum.trim(), contact: contactVal.trim() }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.order) {
        setError(data?.error || "Order not found. Please check your order number and try again.")
        setSearched(true)
        return
      }

      setOrder(data.order)
      setSearched(true)
    } catch {
      setError("Something went wrong. Please try again.")
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTrack = () => {
    if (orderNumber.trim() && contact.trim()) {
      fetchOrder(orderNumber.trim(), contact.trim())
    }
  }

  // Auto-search if both order and email/phone are in URL
  useEffect(() => {
    const urlContact = searchParams.get("email") || searchParams.get("phone") || ""
    if (urlOrder && urlContact) {
      setContact(urlContact)
      fetchOrder(urlOrder, urlContact)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentStatusIndex = order
    ? (ORDER_STATUS_INDEX[order.status] ?? 0)
    : -1

  const isPaid = Boolean(order?.is_paid)
  const terminalState = order ? TERMINAL_STATES[order.status] : undefined

  const trackingNumber = ""

  return (
    <Section className="min-h-screen bg-gradient-to-b from-rose-light/50 to-white">
      <Container>
        <Heading
          as="h1"
          align="center"
          subtitle="Enter your order number and the email or phone number you used at checkout."
        >
          Track Your Order
        </Heading>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-10 max-w-xl"
        >
          <Card className="rounded-3xl border-rose-border/50 ring-0 shadow-sm border">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <Label htmlFor="trackOrderNumber">Order Number</Label>
                <Input
                  id="trackOrderNumber"
                  placeholder="e.g. ORD-MO9E2PK3-RKWT"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                  className="h-11 rounded-xl border-rose-border text-base focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trackContact">Email or Phone Number</Label>
                <Input
                  id="trackContact"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com or 024 412 3456"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                  className="h-11 rounded-xl border-rose-border text-base focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}
              <Button
                onClick={handleTrack}
                disabled={loading || !orderNumber.trim() || !contact.trim()}
                className="w-full gap-2 rounded-xl py-3"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {loading ? "Searching..." : "Track Order"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tracking Result */}
        <AnimatePresence>
          {order && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
              className="mx-auto mt-12 max-w-2xl"
            >
              {/* Status Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-100">
                  <Truck className="size-7 text-rose-600" />
                </div>
                <h2 className="mt-4 font-heading text-xl font-semibold text-navy">
                  Order {order.order_number}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment:{" "}
                  <span className={cn("font-medium", isPaid ? "text-emerald-600" : terminalState ? "text-muted-foreground" : "text-amber-600")}>
                    {order.status === "refunded"
                      ? "Refunded"
                      : isPaid
                        ? "Confirmed"
                        : terminalState
                          ? "Not received"
                          : "Pending"}
                  </span>
                  {trackingNumber && (
                    <> &nbsp;·&nbsp; Tracking: <span className="font-medium text-navy">{trackingNumber}</span></>
                  )}
                </p>
              </div>

              {/* Timeline — replaced by a status card for cancelled/refunded/failed */}
              {terminalState ? (
                <div className={cn("flex items-start gap-4 rounded-3xl border p-6 sm:p-8", terminalState.tone)}>
                  <terminalState.icon className="mt-0.5 size-6 shrink-0" />
                  <div>
                    <h3 className="font-heading font-semibold">{terminalState.label}</h3>
                    <p className="mt-1 text-sm opacity-90">{terminalState.description}</p>
                    <Link href="/contact" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
                      Contact us
                    </Link>
                  </div>
                </div>
              ) : (
              <Card className="rounded-3xl border-rose-border/50 ring-0 shadow-sm border">
                <CardContent className="p-6 sm:p-8">
                  <div className="relative">
                    {STATUS_STEPS.map((step, i) => {
                      const isLast = i === STATUS_STEPS.length - 1
                      const completed = i <= currentStatusIndex
                      const StepIcon = step.icon
                      return (
                        <motion.div
                          key={step.key}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                          className="relative flex gap-4 pb-8 last:pb-0"
                        >
                          {!isLast && (
                            <div
                              className={cn(
                                "absolute left-5 top-10 h-[calc(100%-20px)] w-0.5",
                                completed ? "bg-rose-300" : "bg-rose-border/60"
                              )}
                            />
                          )}
                          <div
                            className={cn(
                              "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full",
                              completed
                                ? "bg-rose-200 text-navy"
                                : "border-2 border-rose-border bg-white text-muted-foreground"
                            )}
                          >
                            <StepIcon className="size-5" />
                          </div>
                          <div className="flex-1 pt-0.5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <h3
                                className={cn(
                                  "font-heading font-semibold",
                                  completed ? "text-navy" : "text-muted-foreground"
                                )}
                              >
                                {step.label}
                              </h3>
                              <span className="text-xs text-muted-foreground">
                                {completed && i === currentStatusIndex
                                  ? new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                                  : completed ? "Done" : "Pending"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {step.description}
                            </p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Order Items */}
              {order.items?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <Card className="mt-6 rounded-3xl border-rose-border/50 ring-0 shadow-sm border">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="size-5 text-rose-primary" />
                        <h3 className="font-heading font-semibold text-navy">Items in Your Order</h3>
                      </div>
                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-pink-50">
                                <Package className="size-4 text-rose-primary/50" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-navy">{item.name}</p>
                                {item.sku && (
                                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                              <p className="text-sm font-semibold text-navy">GH₵{Number(item.unit_price).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-4 bg-rose-border/40" />
                      <div className="flex justify-between font-semibold text-navy">
                        <span>Total</span>
                        <span>GH₵{Number(order.grand_total).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <div className="mt-8 text-center">
                <Link href="/shop">
                  <Button variant="outline" className="rounded-full px-8">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </Section>
  )
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-rose-primary" />
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  )
}
