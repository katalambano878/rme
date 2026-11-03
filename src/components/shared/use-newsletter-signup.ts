"use client"

import { useState } from "react"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = "idle" | "submitting" | "success" | "error"

/**
 * There is no newsletter list in the backend, so a signup is sent to the team
 * through the public contact endpoint (/api/notifications, type "contact").
 * The copy shown to shoppers must not promise automatic emails.
 */
export function useNewsletterSignup(source: string) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState("")

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setStatus("error")
      setError("Please enter a valid email address.")
      return
    }
    setStatus("submitting")
    setError("")
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact",
          payload: {
            name: "Newsletter signup",
            email: value,
            subject: "Newsletter signup",
            message: `Please add ${value} to the newsletter list. (Signed up from: ${source})`,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "We couldn't sign you up right now. Please try again later.")
      setStatus("success")
      setEmail("")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "We couldn't sign you up right now. Please try again later.")
    }
  }

  return { email, setEmail, status, error, submit }
}

export const NEWSLETTER_SUCCESS_COPY =
  "Thanks! We've passed your email to our team and will send news and offers when we have them."
