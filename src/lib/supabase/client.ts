import { createBrowserClient } from "@supabase/ssr"

/** Prefer the current origin in the browser so www↔apex never trip CSP. */
function browserAuthUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")
}

export function createClient() {
  const url = browserAuthUrl()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  }
  return createBrowserClient(url, key)
}
