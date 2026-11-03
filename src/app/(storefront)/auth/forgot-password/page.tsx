"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Loader2, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl text-navy">Forgot your password?</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your email and we&apos;ll send you a link to choose a new one.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-border/60 bg-white p-8 luxury-shadow">
          {sent ? (
            <div className="space-y-4 text-center" role="status">
              <p className="text-navy">
                If an account uses <span className="font-medium">{email.trim()}</span>, a reset link is on its way.
              </p>
              <p className="text-sm text-muted-foreground">
                The link expires in 30 minutes. Check your spam folder if you don&apos;t see it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-xl"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-rose-100 py-5 text-navy hover:bg-rose-200"
              >
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/auth/login" className="font-medium text-rose-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
