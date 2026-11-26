"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { formatCountdown, hasDiscount, offerLine, shopDay, useCampaign } from "./campaign-context"

/**
 * The notice bar. While a campaign is live (or starting within a week) it
 * becomes a tappable bar with a countdown, still in her pink, with the
 * campaign name in a small black tag; otherwise it shows the everyday notice
 * passed in as children.
 */
export function CampaignBar({ children }: { children: ReactNode }) {
  const { campaign, state, remainingMs } = useCampaign()
  if (!campaign || (state !== "live" && state !== "upcoming")) return <>{children}</>

  const live = state === "live"
  const discount = hasDiscount(campaign)
  const line = live ? campaign.message || offerLine(campaign) : `Starts ${shopDay(campaign.startsAt)} · ${offerLine(campaign)}`

  return (
    <Link
      href={discount ? "/shop?sale=1" : "/shop"}
      className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 bg-ink px-4 py-2 text-center text-[13px] leading-snug text-white transition-colors hover:bg-[#23262D] sm:text-sm"
    >
      <span className="rounded-md bg-brand px-2 py-0.5 text-[12px] font-extrabold tracking-[0.08em] uppercase sm:text-[13px]">
        {campaign.name}
      </span>
      <span className="font-semibold">{line}</span>
      <span className="whitespace-nowrap">
        {live ? "Ends in " : "Starts in "}
        <span className="rounded bg-white/15 px-1.5 py-0.5 font-bold tabular-nums" suppressHydrationWarning>
          {formatCountdown(remainingMs)}
        </span>
      </span>
      {live && (
        <span className="hidden font-bold underline underline-offset-2 sm:inline">{discount ? "Shop the deals" : "Shop now"}</span>
      )}
    </Link>
  )
}
