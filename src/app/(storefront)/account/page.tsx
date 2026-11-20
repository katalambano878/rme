"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, LogOut } from "lucide-react"
import { ProductCard } from "@/components/shared/product-card"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { createClient } from "@/lib/supabase/client"
import { formatPrice } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const tabs = [
  { value: "orders", label: "Orders" },
  { value: "profile", label: "Profile" },
  { value: "wishlist", label: "Wishlist" },
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

const PILL_PROCESSING = "bg-[#FFF4D6] text-[#6B4A00]"
const PILL_ON_THE_WAY = "bg-[#E3EEFF] text-[#1D4A8F]"
const PILL_SUCCESS = "bg-[#E2F4E8] text-[#1E6B3A]"
const PILL_NEUTRAL = "bg-counter text-mute"
const PILL_ERROR = "bg-[#FDECEA] text-[#B42318]"

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting payment", className: PILL_PROCESSING },
  paid: { label: "Paid", className: PILL_SUCCESS },
  processing: { label: "Processing", className: PILL_PROCESSING },
  shipped: { label: "Packaged", className: PILL_ON_THE_WAY },
  out_for_delivery: { label: "With rider", className: PILL_ON_THE_WAY },
  delivered: { label: "Delivered", className: PILL_SUCCESS },
  cancelled: { label: "Cancelled", className: PILL_NEUTRAL },
  refunded: { label: "Refunded", className: PILL_NEUTRAL },
  failed: { label: "Payment failed", className: PILL_ERROR },
}

function statusBadge(order: AccountOrder) {
  const known = STATUS_LABELS[order.status]
  if (order.status === "pending" && order.is_paid) return STATUS_LABELS.paid
  return (
    known ?? {
      label: order.status.replace(/_/g, " "),
      className: PILL_NEUTRAL,
    }
  )
}

const labelClass = "text-[15px] font-semibold text-ink"
const inputClass =
  "block min-h-[52px] w-full rounded-[10px] border border-field bg-white px-3.5 text-base text-ink placeholder:text-mute transition-colors duration-150 focus:border-ink"
const linkClass = "font-bold text-raspberry transition-colors duration-150 hover:text-raspberry-deep"
const primaryButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-field bg-white px-4 text-[15px] font-bold text-ink transition-colors duration-150 hover:bg-counter disabled:opacity-60"

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
    <section aria-label="Profile" className="flex flex-wrap items-start gap-8">
      <form onSubmit={handleSave} className="flex min-w-0 max-w-[560px] flex-[999_1_420px] flex-col gap-4">
        <p className="text-[15px] leading-normal text-mute">
          Update the name and phone number we use for your orders.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className={labelClass}>
            Full name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={profile.email}
            readOnly
            disabled
            aria-describedby="email-help"
            className="block min-h-[52px] w-full rounded-[10px] border border-transparent bg-counter px-3.5 text-base text-ink disabled:opacity-100"
          />
          <p id="email-help" className="text-sm text-mute">
            Need to change your email?{" "}
            <Link href="/contact" className={linkClass}>
              Contact us
            </Link>{" "}
            and we&apos;ll help.
          </p>
        </div>

        {message && (
          <p
            role="status"
            className={
              message.type === "success"
                ? "rounded-[10px] bg-[#E2F4E8] px-4 py-3 text-[15px] text-[#1E6B3A]"
                : "rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[15px] text-[#B42318]"
            }
          >
            {message.text}
          </p>
        )}

        <button type="submit" disabled={saving || !dirty} className={`${primaryButton} self-start`}>
          {saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[18px] bg-counter p-6">
        <h2 className="text-lg font-extrabold text-ink">Password</h2>
        <p className="text-[15px] leading-normal text-mute">We&apos;ll email you a link to set a new one.</p>
        <Link href="/auth/forgot-password" className={`${secondaryButton} self-start`}>
          Reset password
        </Link>
      </aside>
    </section>
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
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[15px] text-mute" role="status">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Loading your orders…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[18px] bg-[#FDECEA] p-6" role="alert">
        <p className="text-[15px] text-[#B42318]">{error}</p>
        <button type="button" onClick={onRetry} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[18px] bg-counter p-6 sm:p-8">
        <h2 className="text-[22px] font-extrabold text-ink">No orders yet</h2>
        <p className="text-[15px] leading-normal text-mute">
          Orders placed while signed in to this account show up here.
        </p>
        <Link href="/shop" className={`${primaryButton} mt-1`}>
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <section aria-label="Orders" className="flex flex-col gap-4">
      <p className="text-[15px] text-mute">Orders placed while signed in to this account.</p>
      {orders.map((order) => {
        const badge = statusBadge(order)
        const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0)
        return (
          <article
            key={order.order_number}
            className="flex flex-wrap items-center gap-5 rounded-[18px] border border-line px-5 py-5 sm:px-6 sm:py-[22px]"
          >
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-ink">Order {order.order_number}</h2>
                <span
                  className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[13px] font-bold capitalize ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              {order.items.length > 0 && (
                <p className="text-[15px] leading-normal text-mute">
                  {order.items.map((it) => it.name).join(" · ")}
                </p>
              )}
              <p className="text-sm text-mute">
                {new Date(order.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="ml-auto flex flex-none flex-col items-end gap-2.5">
              <span className="text-xl font-extrabold tabular-nums text-ink">
                {formatPrice(order.grand_total)}
              </span>
              <Link
                href={`/track-order?order=${encodeURIComponent(order.order_number)}`}
                className={secondaryButton}
              >
                Track order
              </Link>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function WishlistTab() {
  const items = useWishlistStore((s) => s.items)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[18px] bg-counter p-6 sm:p-8">
        <h2 className="text-[22px] font-extrabold text-ink">Your wishlist is empty</h2>
        <p className="max-w-md text-[15px] leading-normal text-mute">
          Save pieces you love by tapping the heart icon on any product. Your wishlist is kept on
          this device.
        </p>
        <Link href="/shop" className={`${primaryButton} mt-1`}>
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <section aria-label="Wishlist" className="flex flex-col gap-5">
      <p className="text-[15px] text-mute">
        {`${items.length} ${items.length === 1 ? "piece" : "pieces"} you've saved on this device.`}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>("orders")
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
      <div className="mx-auto flex w-full max-w-[1240px] justify-center px-4 py-24 sm:px-6 lg:px-10">
        <Loader2
          className="size-8 animate-spin text-raspberry motion-reduce:animate-none"
          aria-label="Loading your account"
        />
      </div>
    )
  }

  const firstName = profile.fullName.split(/\s+/)[0]

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pb-[72px] sm:pt-12 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
            {firstName ? `Hi, ${firstName}` : "My account"}
          </h1>
          <p className="break-words text-[17px] text-mute">Signed in as {profile.email}</p>
        </div>
        <button type="button" onClick={handleSignOut} disabled={signingOut} className={secondaryButton}>
          {signingOut ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          Sign out
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-8">
        <TabsList
          variant="line"
          aria-label="Account sections"
          className="flex w-full justify-start gap-1 rounded-none border-b border-line p-0 group-data-horizontal/tabs:h-auto"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-12 flex-none rounded-none border-0 px-[18px] py-0 text-base font-bold text-mute transition-colors duration-150 hover:text-ink data-active:text-ink after:bg-raspberry group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-[3px]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="orders" className="text-base">
          <OrdersTab
            orders={orders}
            loading={ordersLoading}
            error={ordersError}
            onRetry={retryOrders}
          />
        </TabsContent>
        <TabsContent value="profile" className="text-base">
          <ProfileTab profile={profile} onSaved={setProfile} />
        </TabsContent>
        <TabsContent value="wishlist" className="text-base">
          <WishlistTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
