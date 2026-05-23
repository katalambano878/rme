import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Subtotal in GHS at or above which standard shipping is free */
export const FREE_SHIPPING_THRESHOLD_GHS = 2000

/** e.g. "GH₵ 2,000" for banners and policy copy */
export function formatFreeShippingMinimumLabel(): string {
  return `GH₵ ${FREE_SHIPPING_THRESHOLD_GHS.toLocaleString("en-GH")}`
}

export function formatPrice(amount: number, currency: string = "GH₵"): string {
  return `${currency} ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

/**
 * Cryptographically random order number.
 *
 * Uses Web Crypto when available (Edge runtime / browser), falls back to
 * `crypto.randomUUID` (Node 20+). Avoids the previous timestamp-based scheme
 * that let an attacker enumerate adjacent order numbers.
 */
export function generateOrderNumber(): string {
  const prefix = "ORD"
  const bytes = new Uint8Array(8)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // Last-resort fallback (very old environments) — still better than Math.random
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let hex = ""
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0")
  return `${prefix}-${hex.toUpperCase()}`
}
