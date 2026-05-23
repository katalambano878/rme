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
import { createClient } from "@/lib/supabase/client"

const STATUS_STEPS = [
  { key: "pending",    label: "Order Placed",  description: "Your order has been received.", icon: ClipboardCheck },
  { key: "processing", label: "Processing",    description: "Items are being prepared and quality-checked.", icon: Box },
  { key: "shipped",    label: "Shipped",       description: "Your order is on its way.", icon: Truck },
  { key: "delivered",  label: "Delivered",     description: "Your order has been successfully delivered.", icon: CheckCircle2 },
]

const ORDER_STATUS_INDEX: Record<string, number> = {
  pending: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
  paid: 1,
}

function TrackOrderContent() {
  const searchParams = useSearchParams()
  const urlOrder = searchParams.get("order") || ""

  const [orderNumber, setOrderNumber] = useState(urlOrder)
  const [email, setEmail]             = useState("")
  const [order, setOrder]             = useState<any>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState("")
  const [searched, setSearched]       = useState(false)

  const supabase = createClient()

  const fetchOrder = useCallback(async (orderNum: string, emailVal: string) => {
    if (!emailVal.trim()) {
      setError("Please enter your email address to verify your identity.")
      return
    }
    setLoading(true)
    setError("")
    setOrder(null)

    try {
      const { data, error: fetchError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          grand_total,
          guest_email,
          guest_phone,
          created_at,
          shipping_address,
          payments(status),
          order_items (
            id,
            name_snapshot,
            sku_snapshot,
            quantity,
            unit_price
          )
        `)
        .eq("order_number", orderNum.trim())
        .single()

      if (fetchError || !data) {
        setError("Order not found. Please check your order number and try again.")
        setSearched(true)
        return
      }

      if (data.guest_email?.toLowerCase() !== emailVal.trim().toLowerCase()) {
        setError("The email address does not match this order. Please use the email you placed the order with.")
        setSearched(true)
        return
      }

      setOrder(data)
      setSearched(true)
    } catch {
      setError("Something went wrong. Please try again.")
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const handleTrack = () => {
    if (orderNumber.trim() && email.trim()) {
      fetchOrder(orderNumber.trim(), email.trim())
    }
  }

  // Auto-search if both order and email are in URL
  useEffect(() => {
    const urlEmail = searchParams.get("email") || ""
    if (urlOrder && urlEmail) {
      setEmail(urlEmail)
      fetchOrder(urlOrder, urlEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentStatusIndex = order
    ? (ORDER_STATUS_INDEX[order.status] ?? 0)
    : -1

  const isPaid = (order?.payments as { status: string }[] | null)?.some(
    (p) => p.status === "paid" || p.status === "completed"
  )

  const trackingNumber = ""

  return (
    <Section className="min-h-screen bg-gradient-to-b from-rose-light/50 to-white">
      <Container>
        <Heading
          as="h1"
          align="center"
          subtitle="Enter your order number and email to see real-time updates on your delivery."
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
                <Label htmlFor="trackEmail">Email Address</Label>
                <Input
                  id="trackEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                disabled={loading || !orderNumber.trim() || !email.trim()}
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
                  <span className={cn("font-medium", isPaid ? "text-emerald-600" : "text-amber-600")}>
                    {isPaid ? "Confirmed" : "Pending"}
                  </span>
                  {trackingNumber && (
                    <> &nbsp;·&nbsp; Tracking: <span className="font-medium text-navy">{trackingNumber}</span></>
                  )}
                </p>
              </div>

              {/* Timeline */}
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

              {/* Order Items */}
              {order.order_items?.length > 0 && (
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
                        {order.order_items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-pink-50">
                                <Package className="size-4 text-rose-primary/50" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-navy">{item.name_snapshot}</p>
                                {item.sku_snapshot && (
                                  <p className="text-xs text-muted-foreground">{item.sku_snapshot}</p>
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
