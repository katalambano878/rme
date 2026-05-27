import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

// Compatibility admin client used by imported auth utilities.
//
// Lazy-initialized via a Proxy: this lets routes import `supabaseAdmin` at
// the top of their files without triggering `createAdminClient()` at module
// load time. Eager init blew up `next build` page-data collection when env
// vars weren't injected into the worker (and would also break local dev /
// any test environment without a service-role key configured).
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!_client) _client = createAdminClient()
  return _client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop)
  },
})
