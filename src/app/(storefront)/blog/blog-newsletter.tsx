"use client"

import { motion } from "framer-motion"
import { Loader2, Mail } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NEWSLETTER_SUCCESS_COPY, useNewsletterSignup } from "@/components/shared/use-newsletter-signup"

export function BlogNewsletter() {
  const { email, setEmail, status, error, submit } = useNewsletterSignup("blog")
  const submitting = status === "submitting"

  return (
    <Section className="bg-gradient-to-b from-white to-rose-light/30">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className="mx-auto max-w-xl text-center"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-light">
            <Mail className="size-6 text-rose-primary" />
          </div>
          <h2 className="mt-5 font-heading text-2xl font-semibold text-navy sm:text-3xl">
            Stay in the Loop
          </h2>
          <p className="mt-3 text-muted-foreground">
            Leave your email and we&apos;ll share beauty tips, new arrivals and
            offers.
          </p>
          {status === "success" ? (
            <p
              role="status"
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-700"
            >
              {NEWSLETTER_SUCCESS_COPY}
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                aria-label="Email address"
                placeholder="Enter your email"
                className="h-11 rounded-xl border-rose-border px-4 sm:w-72 focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
              />
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 gap-2 rounded-xl bg-rose-100 px-6 text-navy hover:bg-rose-200"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Subscribe
              </Button>
            </form>
          )}
          {status === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            No spam, ever.
          </p>
        </motion.div>
      </Container>
    </Section>
  )
}
