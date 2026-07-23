import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isPlainPostgres } from "@/lib/db/mode"
import { createClient as createPgClient } from "@/lib/db/supabase-compat"

export async function createClient() {
  if (isPlainPostgres()) {
    return createPgClient()
  }

  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          /* set from Server Component — ignore if read-only */
        }
      },
    },
  })
}

export function createServiceClient() {
  if (isPlainPostgres()) {
    return createPgClient()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
