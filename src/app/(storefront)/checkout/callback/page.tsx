"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Button } from "@/components/ui/button"

function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reference = searchParams.get("reference") || searchParams.get("trxref")

  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying")
  const [orderNumber, setOrderNumber] = useState("")

  useEffect(() => {
    if (!reference) {
      setStatus("failed")
      return
    }

    async function verify() {
      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference!)}`)
        const data = await res.json()

        if (data.verified) {
          setStatus("success")
          setOrderNumber(data.order_number || reference!)

          const pending = sessionStorage.getItem("pendingOrder")
          if (pending) {
            const parsed = JSON.parse(pending)
            parsed.orderNumber = data.order_number || reference
            sessionStorage.setItem("lastOrder", JSON.stringify(parsed))
            sessionStorage.removeItem("pendingOrder")
          }

          setTimeout(() => {
            router.push("/checkout/success")
          }, 2500)
        } else {
          setStatus("failed")
          setOrderNumber(data.order_number || reference!)
        }
      } catch {
        setStatus("failed")
      }
    }

    verify()
  }, [reference, router])

  return (
    <main className="min-h-[60vh]">
      <Container className="flex flex-col items-center justify-center py-24 text-center">
        {status === "verifying" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="size-12 animate-spin text-rose-primary" />
            <h1 className="font-heading text-2xl font-semibold text-navy">
              Verifying your payment…
            </h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your transaction.
            </p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <CheckCircle2 className="size-16 text-emerald-500" />
            <h1 className="font-heading text-2xl font-semibold text-navy">
              Payment Successful!
            </h1>
            <p className="text-muted-foreground">
              Order <span className="font-semibold text-navy">{orderNumber}</span> has been confirmed.
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to your order summary…</p>
          </motion.div>
        )}

        {status === "failed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <XCircle className="size-16 text-red-500" />
            <h1 className="font-heading text-2xl font-semibold text-navy">
              Payment Failed
            </h1>
            <p className="max-w-md text-muted-foreground">
              We couldn&apos;t verify your payment. If money was deducted, it will be refunded automatically.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/checkout">
                <Button className="rounded-full px-8">Try Again</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="rounded-full px-8">Continue Shopping</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </Container>
    </main>
  )
}

export default function CheckoutCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[60vh]">
          <Container className="flex items-center justify-center py-24">
            <Loader2 className="size-10 animate-spin text-rose-primary" />
          </Container>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
