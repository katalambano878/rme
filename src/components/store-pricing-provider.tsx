"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabase"
import {
  DEFAULT_STORE_PRICING,
  campaignState,
  parseCampaign,
  parseStorePricing,
  type StorePricing,
} from "@/lib/effective-price"

type StorePricingContextType = StorePricing & {
  loading: boolean
  refresh: () => Promise<void>
}

const StorePricingContext = createContext<StorePricingContextType>({
  ...DEFAULT_STORE_PRICING,
  loading: true,
  refresh: async () => {},
})

export function StorePricingProvider({ children }: { children: ReactNode }) {
  const [pricing, setPricing] = useState<StorePricing>(DEFAULT_STORE_PRICING)
  const [flags, setFlags] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("feature_flags")
        .eq("id", 1)
        .maybeSingle()
      if (error) {
        setPricing(DEFAULT_STORE_PRICING)
        return
      }
      setFlags(data?.feature_flags ?? null)
      setPricing(parseStorePricing(data?.feature_flags))
    } catch {
      setPricing(DEFAULT_STORE_PRICING)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // A Black Friday campaign starts and ends at set times: re-price an open
  // page at that moment instead of waiting for a reload.
  useEffect(() => {
    const campaign = parseCampaign(flags)
    const state = campaignState(campaign)
    if (!campaign || (state !== "upcoming" && state !== "live")) return
    const at = Date.parse(state === "upcoming" ? campaign.startsAt : campaign.endsAt)
    const wait = at - Date.now() + 500
    if (wait <= 0 || wait > 2_000_000_000) return
    const id = window.setTimeout(() => setPricing(parseStorePricing(flags)), wait)
    return () => window.clearTimeout(id)
  }, [flags, pricing])

  return (
    <StorePricingContext.Provider value={{ ...pricing, loading, refresh }}>
      {children}
    </StorePricingContext.Provider>
  )
}

export function useStorePricing(): StorePricingContextType {
  return useContext(StorePricingContext)
}
