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

  return (
    <StorePricingContext.Provider value={{ ...pricing, loading, refresh }}>
      {children}
    </StorePricingContext.Provider>
  )
}

export function useStorePricing(): StorePricingContextType {
  return useContext(StorePricingContext)
}
