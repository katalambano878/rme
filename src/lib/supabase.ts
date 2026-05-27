import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

// Compatibility browser client used by imported admin pages.
//
// Lazy-initialized via a Proxy: many admin pages import `supabase` at the
// top of their module. During `next build` prerender these pages get loaded
// in worker processes that don't always have NEXT_PUBLIC_SUPABASE_URL /
// _ANON_KEY in env, and the eager `createClient()` call would throw and
// kill the entire build. Deferring init until first use sidesteps that
// without changing any callsites.
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!_client) _client = createClient() as unknown as SupabaseClient
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop)
  },
})
