"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Send, MessageCircle } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { WHATSAPP_URL } from "@/lib/brand"

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSubmitted(true)
  }

  return (
    <Section className="bg-rose-light">
      <Container>
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className="mx-auto max-w-xl text-center"
        >
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Stay in the Loop
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Be the first to know about new arrivals, exclusive offers, and style tips.
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5"
            >
              <p className="text-sm font-semibold text-emerald-700">
                Welcome to the inner circle! Check your inbox for a surprise.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="min-w-0 flex-1 rounded-full border border-rose-border bg-white px-5 py-3.5 text-sm text-navy placeholder:text-muted-foreground/60 transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/40"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-rose-100 px-6 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:bg-rose-200 hover:shadow-md hover:shadow-rose-200/40 active:scale-[0.98]"
              >
                <Send className="size-4" />
                <span className="hidden sm:inline">Subscribe</span>
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <span>Or chat with us on</span>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-600 transition-colors hover:text-emerald-500"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </div>
        </motion.div>
      </Container>
    </Section>
  )
}
