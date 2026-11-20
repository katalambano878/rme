"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const labelClass = "text-[15px] font-semibold text-ink"
const inputClass =
  "block min-h-[52px] w-full rounded-[10px] border border-field bg-white px-3.5 text-base text-ink placeholder:text-mute transition-colors duration-150 focus:border-ink"
const linkClass = "font-bold text-raspberry transition-colors duration-150 hover:text-raspberry-deep"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim())
    setLoading(false)
    if (resetError) {
      setError(resetError.message || "Could not send the reset link. Please try again.")
      return
    }
    setSent(true)
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-10 sm:px-6 sm:pb-[72px] sm:pt-14 lg:px-8">
      <section className="flex w-full max-w-[520px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
            Forgot your password?
          </h1>
          <p className="text-[17px] leading-[1.55] text-mute">
            Enter your email and we&apos;ll send you a link to choose a new one.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-counter p-6" role="status">
            <p className="text-[17px] leading-[1.55] text-ink">
              If an account uses <span className="font-semibold">{email.trim()}</span>, a reset link is on its way.
            </p>
            <p className="text-[15px] leading-normal text-mute">
              The link expires in 30 minutes. Check your spam folder if you don&apos;t see it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-[15px] text-mute">
          Remembered it?{" "}
          <Link href="/auth/login" className={linkClass}>
            Sign in
          </Link>
        </p>
      </section>
    </div>
  )
}
