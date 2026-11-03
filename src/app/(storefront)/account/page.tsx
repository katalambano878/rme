"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  User,
  Package,
  Heart,
  ChevronRight,
  ShoppingBag,
  Loader2,
  LogOut,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { ProductCard } from "@/components/shared/product-card"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { createClient } from "@/lib/supabase/client"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

const tabs = [
  { value: "profile", label: "Profile", icon: User },
  { value: "orders", label: "Orders", icon: Package },
  { value: "wishlist", label: "Wishlist", icon: Heart },
] as const

type AccountProfile = {
  id: string
  email: string
  fullName: string
  phone: string
}

type AccountOrder = {
  order_number: string
  status: string
  grand_total: number
  created_at: string
  is_paid: boolean
  items: { id: string; name: string; quantity: number }[]
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting payment", className: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processing: { label: "Processing", className: "bg-amber-50 text-amber-700 border-amber-200" },
  shipped: { label: "Packaged", className: "bg-blue-50 text-blue-700 border-blue-200" },
  out_for_delivery: { label: "With rider", className: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-50 text-slate-600 border-slate-200" },
  refunded: { label: "Refunded", className: "bg-slate-50 text-slate-600 border-slate-200" },
  failed: { label: "Payment failed", className: "bg-red-50 text-red-700 border-red-200" },
}

function statusBadge(order: AccountOrder) {
  const known = STATUS_LABELS[order.status]
  if (order.status === "pending" && order.is_paid) return STATUS_LABELS.paid
  return (
    known ?? {
      label: order.status.replace(/_/g, " "),
      className: "bg-slate-50 text-slate-600 border-slate-200",
    }
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

const inputClass =
  "h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"

function ProfileTab({
  profile,
  onSaved,
}: {
  profile: AccountProfile
  onSaved: (next: AccountProfile) => void
}) {
  const [fullName, setFullName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const dirty = fullName.trim() !== profile.fullName || phone.trim() !== profile.phone

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    const tel = phone.trim()
    if (!name) {
      setMessage({ type: "error", text: "Please enter your name." })
      return
    }
    if (tel && tel.replace(/\D/g, "").length < 9) {
      setMessage({ type: "error", text: "Please enter a valid phone number." })
      return
    }
    setSaving(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: { full_name: name, phone: tel } })
    setSaving(false)
    if (error) {
      setMessage({ type: "error", text: error.message || "Could not save your details. Please try again." })
      return
    }
    onSaved({ ...profile, fullName: name, phone: tel })
    setMessage({ type: "success", text: "Your details have been saved." })
  }

  return (
    <motion.form
      onSubmit={handleSave}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          Personal Information
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the name and phone number we use for your orders.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={20}
            placeholder="e.g. 024 412 3456"
            className={inputClass}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            readOnly
            disabled
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Need to change your email? Contact us and we&apos;ll help.
          </p>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={
            message.type === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
          }
        >
          {message.text}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving || !dirty}
        className="gap-2 rounded-xl bg-rose-100 px-8 py-2.5 text-navy hover:bg-rose-200"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </motion.form>
  )
}

function OrdersTab({
  orders,
  loading,
  error,
  onRetry,
}: {
  orders: AccountOrder[]
  loading: boolean
  error: string
  onRetry: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          Order History
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders placed while signed in to this account.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your orders…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={onRetry}
            className="mt-3 rounded-xl border-red-200 text-red-600"
          >
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-[#FFF5F5]">
            <Package className="size-8 text-rose-300" />
          </div>
          <h4 className="mt-6 font-heading text-xl font-semibold text-navy">
            No orders yet
          </h4>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            When you place an order it will show up here.
          </p>
          <Button
            className="mt-6 gap-2 rounded-xl border border-rose-200 bg-[#FFF5F5] px-6 text-rose-400 hover:bg-rose-100"
            render={<Link href="/shop" />}
          >
            <ShoppingBag className="size-4" />
            Start Shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, i) => {
            const badge = statusBadge(order)
            const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0)
            return (
              <motion.div
                key={order.order_number}
                custom={Math.min(i, 8)}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
              >
                <Card className="overflow-hidden rounded-2xl border-rose-border/50 ring-0 shadow-none border">
                  <CardContent className="p-0">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-heading font-semibold text-navy">
                            {order.order_number}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          · {itemCount} {itemCount === 1 ? "item" : "items"}
                        </p>
                        {order.items.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">
                            {order.items.map((it) => it.name).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-heading text-lg font-semibold text-navy">
                          {formatPrice(order.grand_total)}
                        </p>
                        <Button
                          variant="outline"
                          className="gap-1.5 rounded-xl border-rose-border text-navy hover:border-rose-primary hover:text-rose-primary"
                          render={
                            <Link
                              href={`/track-order?order=${encodeURIComponent(order.order_number)}`}
                            />
                          }
                        >
                          Track
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

function WishlistTab() {
  const items = useWishlistStore((s) => s.items)

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-[#FFF5F5]">
          <Heart className="size-8 text-rose-300" />
        </div>
        <h3 className="mt-6 font-heading text-xl font-semibold text-navy">
          Your wishlist is empty
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Save pieces you love by tapping the heart icon on any product. Your
          wishlist is kept on this device.
        </p>
        <Button
          className="mt-6 gap-2 rounded-xl border border-rose-200 bg-[#FFF5F5] px-6 text-rose-400 hover:bg-rose-100"
          render={<Link href="/shop" />}
        >
          <ShoppingBag className="size-4" />
          Start Shopping
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          My Wishlist
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${items.length} ${items.length === 1 ? "piece" : "pieces"} you've saved on this device.`}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </motion.div>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>("profile")
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [orders, setOrders] = useState<AccountOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState("")
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab")
    if (tabParam && tabs.some((tab) => tab.value === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [])

  const loadOrders = useCallback(async (accessToken: string) => {
    setOrdersLoading(true)
    setOrdersError("")
    try {
      const res = await fetch("/api/account/orders", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Could not load your orders.")
      setOrders(Array.isArray(json.orders) ? json.orders : [])
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Could not load your orders.")
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const loadAccount = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      router.replace("/auth/login?redirect=/account")
      return
    }
    const user = session.user
    const meta = (user.user_metadata || {}) as Record<string, unknown>

    const { data: row } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle()

    setProfile({
      id: user.id,
      email: String(row?.email || user.email || ""),
      fullName: String(row?.full_name || meta.full_name || ""),
      phone: String(row?.phone || meta.phone || user.phone || ""),
    })

    void loadOrders(session.access_token)
  }, [router, loadOrders])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  async function retryOrders() {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.replace("/auth/login?redirect=/account")
      return
    }
    void loadOrders(session.access_token)
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (!profile) {
    return (
      <Section className="min-h-screen bg-gradient-to-b from-rose-light/50 to-white">
        <Container className="flex justify-center py-24">
          <Loader2 className="size-8 animate-spin text-rose-primary" aria-label="Loading your account" />
        </Container>
      </Section>
    )
  }

  const firstName = profile.fullName.split(/\s+/)[0]

  return (
    <Section className="min-h-screen bg-gradient-to-b from-rose-light/50 to-white">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Heading
            as="h1"
            subtitle={`Signed in as ${profile.email}`}
          >
            {firstName ? `Hi, ${firstName}` : "My Account"}
          </Heading>
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={signingOut}
            className="gap-2 self-start rounded-xl border-rose-border text-navy hover:border-rose-primary hover:text-rose-primary sm:self-auto"
          >
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Sign out
          </Button>
        </div>

        <div className="mt-10">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className="mb-8 flex h-auto w-full flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-rose-border/50 sm:w-fit"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-active:border data-active:border-rose-200 data-active:bg-[#FFF5F5] data-active:text-rose-400 data-active:shadow-none hover:text-navy"
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="profile">
              <ProfileTab profile={profile} onSaved={setProfile} />
            </TabsContent>
            <TabsContent value="orders">
              <OrdersTab
                orders={orders}
                loading={ordersLoading}
                error={ordersError}
                onRetry={retryOrders}
              />
            </TabsContent>
            <TabsContent value="wishlist">
              <WishlistTab />
            </TabsContent>
          </Tabs>
        </div>
      </Container>
    </Section>
  )
}
