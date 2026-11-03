/**
 * Only same-site relative paths are allowed as post-auth destinations.
 * Rejects absolute URLs, protocol-relative "//host" and "/\host" tricks.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw) return fallback
  const value = raw.trim()
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return fallback
  }
  return value
}

/** Reads ?redirect= from the current URL (client only). */
export function redirectParamFromLocation(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("redirect")
}
