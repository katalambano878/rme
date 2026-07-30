import { createClient as createSupabaseJsClient } from "@supabase/supabase-js"
import { isPlainPostgres } from "@/lib/db/mode"
import { createClient as createPgClient } from "@/lib/db/supabase-compat"

/**
 * Service-role / admin client — server-only. Never import in client components.
 *
 * Plain Postgres (DATABASE_URL set): in-process pg compat + auth/storage shims.
 * Otherwise: hosted Supabase service-role client.
 *
 * Callers treat this as a supabase-js-shaped client; in plain-PG mode the
 * return type is intentionally loose.
 */
export function createAdminClient(): any {
  if (isPlainPostgres()) {
    return createPgClient()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    )
  }
  return createSupabaseJsClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
