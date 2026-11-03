/**
 * Simple in-memory rate limiter for API routes.
 * For multi-instance production, prefer Redis-backed limiting.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) rateLimitStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number
}

export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  let entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + windowMs }
    rateLimitStore.set(identifier, entry)
    return { success: true, remaining: config.maxRequests - 1, resetIn: config.windowSeconds }
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetIn: Math.ceil((entry.resetTime - now) / 1000) }
  }

  entry.count++
  rateLimitStore.set(identifier, entry)
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  }
}

/**
 * Client IP as seen by our own reverse proxy. The left-most X-Forwarded-For
 * entry is whatever the caller typed, so it must not be trusted; the proxy
 * appends the real address on the right. Set TRUSTED_PROXY_HOPS when more than
 * one proxy (e.g. a CDN in front of the server proxy) sits in front of the app.
 */
export function getClientIdentifier(request: Request): string {
  if (process.env.TRUST_CF_CONNECTING_IP === "true") {
    const cf = request.headers.get("cf-connecting-ip")
    if (cf) return cf.trim()
  }
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean)
    const trusted = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1)
    const ip = hops[Math.max(0, hops.length - trusted)]
    if (ip) return ip
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

export const RATE_LIMITS = {
  payment: { maxRequests: 10, windowSeconds: 60 },
  callback: { maxRequests: 50, windowSeconds: 60 },
  notification: { maxRequests: 20, windowSeconds: 60 },
  // Anti-LLM-abuse limits. These protect the GROQ wallet — without them an
  // attacker can drain the daily budget with a single curl loop.
  chat: { maxRequests: 30, windowSeconds: 60 },
  chatBurst: { maxRequests: 200, windowSeconds: 60 * 60 },
  transcribe: { maxRequests: 10, windowSeconds: 60 },
  speak: { maxRequests: 20, windowSeconds: 60 },
  // Password guessing: per IP and per email address.
  login: { maxRequests: 10, windowSeconds: 10 * 60 },
  loginEmail: { maxRequests: 8, windowSeconds: 15 * 60 },
  signup: { maxRequests: 5, windowSeconds: 60 * 60 },
  orderCreate: { maxRequests: 10, windowSeconds: 10 * 60 },
  // Forgot-password emails/SMS: per IP and per address.
  passwordReset: { maxRequests: 5, windowSeconds: 60 * 60 },
  passwordResetEmail: { maxRequests: 3, windowSeconds: 60 * 60 },
  default: { maxRequests: 100, windowSeconds: 60 },
}
