import {
  DEFAULT_STORE_PRICING,
  parseStorePricing,
  type StorePricing,
} from "@/lib/effective-price"

export async function fetchStorePricing(client: {
  from: (table: string) => any
}): Promise<StorePricing> {
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
