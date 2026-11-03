import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupabaseCompatClient } from "@/lib/db/supabase-compat"
import {
  DEFAULT_STORE_PRICING,
  parseStorePricing,
  type StorePricing,
} from "@/lib/effective-price"

export async function fetchStorePricing(
  client: Pick<SupabaseClient, "from"> | Pick<SupabaseCompatClient, "from">,
): Promise<StorePricing> {
  try {
    const { data } = await client
      .from("site_settings")
      .select("feature_flags")
      .eq("id", 1)
      .maybeSingle()
    return parseStorePricing(data?.feature_flags)
  } catch {
    return DEFAULT_STORE_PRICING
  }
}
