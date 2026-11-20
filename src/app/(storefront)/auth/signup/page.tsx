"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { BRAND_LOGO_SRC, BRAND_TAGLINE } from "@/lib/brand"
import { redirectParamFromLocation, safeRedirectPath } from "../safe-redirect"

const labelClass = "text-[15px] font-semibold text-ink"
const inputClass =
  "block min-h-[52px] w-full rounded-[10px] border border-field bg-white px-3.5 text-base text-ink placeholder:text-mute transition-colors duration-150 focus:border-ink"

/** Sign in / Create account switcher. They are separate routes, so these are links. */
function AuthTabLinks({ active, redirect }: { active: "login" | "signup"; redirect: string | null }) {
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""
  const tabs = [
    { key: "login", label: "Sign in", href: `/auth/login${query}` },
    { key: "signup", label: "Create account", href: `/auth/signup${query}` },
  ] as const
  return (
    <nav aria-label="Account" className="flex self-start rounded-[14px] bg-counter p-[5px]">
      {tabs.map((tab) => {
        const current = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-[10px] px-5 text-[15px] font-bold text-ink transition-colors duration-150 ${
              current ? "bg-white shadow-[0_1px_3px_rgba(22,24,29,0.15)]" : "hover:bg-counter-deep"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

function AuthTabsWithParams({ active }: { active: "login" | "signup" }) {
  const redirect = useSearchParams().get("redirect")
  return <AuthTabLinks active={active} redirect={redirect} />
}

function AuthTabs({ active }: { active: "login" | "signup" }) {
  return (
    <Suspense fallback={<AuthTabLinks active={active} redirect={null} />}>
      <AuthTabsWithParams active={active} />
    </Suspense>
  )
}

function BagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none text-raspberry">
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none text-raspberry">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none text-raspberry">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  )
}

function BenefitsPanel() {
  return (
    <aside
      aria-label="Why have an account"
      className="flex min-w-0 flex-[1_1_340px] flex-col justify-between gap-8 rounded-3xl bg-blush p-7 sm:p-10"
    >
      <div className="flex flex-col gap-[22px]">
        <h2 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[30px]">
          Restocking is quicker with an account
        </h2>
        <ul className="flex flex-col gap-[18px] text-base leading-normal text-ink">
          <li className="flex items-start gap-3.5">
            <BagIcon />
            <span>
              <strong className="font-bold">Every order in one place.</strong> See what you bought and when.
            </span>
          </li>
          <li className="flex items-start gap-3.5">
            <TruckIcon />
            <span>
              <strong className="font-bold">Track deliveries.</strong> Follow each order from processing to your door.
            </span>
          </li>
          <li className="flex items-start gap-3.5">
            <HeartIcon />
            <span>
              <strong className="font-bold">Keep a wishlist</strong> of the things you want next.
            </span>
          </li>
        </ul>
      </div>
      <Image
        src={BRAND_LOGO_SRC}
        alt={BRAND_TAGLINE}
        width={478}
        height={223}
        className="h-20 w-auto self-start"
      />
    </aside>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Sign-up returns a live session, so go straight to the account (or the
    // page that sent the shopper here) instead of a "check your email" screen.
    if (data.session) {
      router.push(safeRedirectPath(redirectParamFromLocation(), "/account"))
      router.refresh()
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] px-4 pb-16 pt-10 sm:px-6 sm:pb-[72px] sm:pt-14 lg:px-8">
        <section role="status" className="flex w-full max-w-[520px] flex-col items-start gap-4 rounded-3xl bg-counter p-7 sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#E2F4E8] text-[#1E6B3A]">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[36px]">
            Account created
          </h1>
          <p className="text-[17px] leading-[1.55] text-mute">
            Your account for <strong className="font-semibold text-ink">{email}</strong> is ready. Sign in to
            continue.
          </p>
          <Link
            href="/auth/login"
            className="mt-2 inline-flex min-h-14 items-center justify-center rounded-xl bg-brand px-8 text-[17px] font-bold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Go to sign in
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-stretch gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pb-[72px] sm:pt-14 lg:px-8">
      <section className="flex min-w-0 max-w-[520px] flex-[999_1_420px] flex-col gap-6">
        <AuthTabs active="signup" />

        <div className="flex flex-col gap-2">
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
            Create your account
          </h1>
          <p className="text-[17px] leading-[1.55] text-mute">
            It takes a minute. Your orders stay together in one place.
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className={labelClass}>
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className={`${inputClass} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="password"
                className="absolute inset-y-1 right-1 min-h-11 rounded-lg px-3.5 text-sm font-bold text-ink transition-colors duration-150 hover:bg-counter"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[15px] text-[#B42318]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="rounded-[14px] bg-counter px-[18px] py-4 text-[15px] leading-normal text-ink">
          No account needed to order.{" "}
          <Link
            href="/checkout"
            className="font-bold text-raspberry transition-colors duration-150 hover:text-raspberry-deep"
          >
            Check out as a guest
          </Link>{" "}
          and track your order with its number and your phone or email.
        </p>
      </section>

      <BenefitsPanel />
    </div>
  )
}
