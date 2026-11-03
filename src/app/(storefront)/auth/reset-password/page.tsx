"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      <div className="space-y-4 text-center">
        <p className="text-navy">This reset link is incomplete.</p>
        <Link href="/auth/forgot-password" className="font-medium text-rose-primary hover:underline">
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <p className="text-navy">Your password has been changed. You&apos;ve been signed out everywhere else.</p>
        <Link
          href="/auth/login"
          className="inline-flex rounded-full bg-rose-100 px-6 py-2.5 font-medium text-navy transition-colors hover:bg-rose-200"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="rounded-xl pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="rounded-xl"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}{" "}
          {/expired|invalid/i.test(error) && (
            <Link href="/auth/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          )}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-rose-100 py-5 text-navy hover:bg-rose-200"
      >
        {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
        Save new password
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl text-navy">Choose a new password</h1>
        </div>
        <div className="rounded-2xl border border-rose-border/60 bg-white p-8 luxury-shadow">
          <Suspense fallback={<Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </motion.div>
    </div>
  )
}
