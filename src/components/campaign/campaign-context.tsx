"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { campaignState, type Campaign, type CampaignState } from "@/lib/effective-price"

type CampaignContextValue = {
  campaign: Campaign | null
  state: CampaignState
  /** Milliseconds until the next change (start while upcoming, end while live). */
  remainingMs: number
}

const CampaignContext = createContext<CampaignContextValue>({ campaign: null, state: "off", remainingMs: 0 })

const TEASER_DAYS = 7

/**
 * Shares the scheduled campaign (Black Friday etc.) with the storefront and
 * keeps one clock ticking, so the countdowns move and everything switches
 * over at the exact start and end time without a reload.
 */
export function CampaignProvider({
  campaign,
  serverNow,
  children,
}: {
  campaign: Campaign | null
  serverNow: number
  children: ReactNode
}) {
  // Start from the server's clock so the first render matches the HTML.
  const [now, setNow] = useState(serverNow)

  useEffect(() => {
    if (!campaign || !campaign.enabled) return
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [campaign])

  let state = campaignState(campaign, now)
  let remainingMs = 0
  if (campaign && state === "upcoming") {
    remainingMs = Date.parse(campaign.startsAt) - now
    // Only tease it in the last week before it starts.
    if (remainingMs > TEASER_DAYS * 86_400_000) state = "off"
  } else if (campaign && state === "live") {
    remainingMs = Date.parse(campaign.endsAt) - now
  }

  return <CampaignContext.Provider value={{ campaign, state, remainingMs }}>{children}</CampaignContext.Provider>
}

export function useCampaign() {
  return useContext(CampaignContext)
}

/** "2d 4h", "4h 12m", "12m 05s". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, "0")}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
  return `${m}m ${String(s).padStart(2, "0")}s`
}

/** "Fri 27 Nov" in Ghana time. */
export function shopDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** The headline offer, e.g. "20% off everything". */
export function offerLine(c: Campaign): string {
  return c.discountPercent > 0 ? `${c.discountPercent}% off everything` : "Big savings across the store"
}

/** The last full day of the sale (an end of Mon 00:00 means it runs through Sunday). */
export function lastDay(c: Campaign): string {
  return shopDay(new Date(Date.parse(c.endsAt) - 1).toISOString())
}
