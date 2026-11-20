"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useCartStore } from "@/lib/store/cart-store"

const PING_EVERY_MS = 30_000

function visitorId(): string {
  const key = "rme-visitor"
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return ""
  }
}

export function LiveShopperPing() {
  const pathname = usePathname() || "/"
  const items = useCartStore((s) => s.items)
  const latest = useRef({ pathname, items })

  useEffect(() => {
    // Updated here rather than during render (refs mustn't change while rendering).
    latest.current = { pathname, items }
    const id = visitorId()
    if (!id) return

    const ping = () => {
      if (document.visibilityState !== "visible") return
      const { pathname: page, items: bag } = latest.current
      const cartItems = bag.reduce((sum, item) => sum + item.quantity, 0)
      const cartValue = bag.reduce((sum, item) => {
        const price = item.product.salePrice ?? item.product.price
        return sum + (Number(price) || 0) * item.quantity
      }, 0)
      fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: id, page, cartItems, cartValue }),
        keepalive: true,
      }).catch(() => {})
    }

    ping()
    const timer = window.setInterval(ping, PING_EVERY_MS)
    document.addEventListener("visibilitychange", ping)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", ping)
    }
  }, [pathname, items])

  return null
}
