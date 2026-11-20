"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

const labelClass = "text-[15px] font-semibold text-ink"
const inputClass =
  "block min-h-[52px] w-full rounded-[10px] border border-field bg-white px-3.5 text-base text-ink placeholder:text-mute transition-colors duration-150 focus:border-ink"
const linkClass = "font-bold text-raspberry transition-colors duration-150 hover:text-raspberry-deep"

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 6) {
      setError("Use at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setLoading(true)
    const res = await fetch("/auth/v1/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setLoading(false)
    if (!res?.ok) {
      setError(json?.error_description || json?.msg || "Could not reset your password. Please try again.")
      return
    }
    setDone(true)
  }

  if (!token) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[18px] bg-counter p-6">
        <p className="text-[17px] leading-[1.55] text-ink">This reset link is incomplete.</p>
        <Link href="/auth/forgot-password" className={linkClass}>
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[18px] bg-counter p-6" role="status">
        <p className="text-[17px] leading-[1.55] text-ink">
          Your password has been changed. You&apos;ve been signed out everywhere else.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-brand px-6 text-base font-bold text-white transition-opacity duration-150 hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={`${inputClass} pr-20`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="password confirm"
            className="absolute inset-y-1 right-1 min-h-11 rounded-lg px-3.5 text-sm font-bold text-ink transition-colors duration-150 hover:bg-counter"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[15px] text-[#B42318]">
          {error}{" "}
          {/expired|invalid/i.test(error) && (
            <Link href="/auth/forgot-password" className="font-bold underline">
              Request a new link
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
      >
        {loading && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {loading ? "Saving…" : "Save new password"}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-10 sm:px-6 sm:pb-[72px] sm:pt-14 lg:px-8">
      <section className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
          Choose a new password
        </h1>
        <Suspense
          fallback={
            <Loader2
              className="size-5 animate-spin text-mute motion-reduce:animate-none"
              aria-label="Loading"
            />
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </section>
    </div>
  )
}
