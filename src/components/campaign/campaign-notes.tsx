"use client"

import { formatCountdown, lastDay, useCampaign } from "./campaign-context"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"

/** Small black Black Friday note beside Add to bag on the product page. */
export function CampaignProductNote() {
  const { campaign, state, remainingMs } = useCampaign()
  if (!campaign || state !== "live") return null
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-ink px-4 py-3.5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-brand px-2 py-0.5 text-[12px] font-extrabold tracking-[0.08em] uppercase">
          {campaign.name}
        </span>
        <span className="text-[14px] text-white/70">
          Ends in{" "}
          <strong className="font-bold text-white tabular-nums" suppressHydrationWarning>
            {formatCountdown(remainingMs)}
          </strong>
        </span>
      </div>
      <p className="m-0 text-[15px] leading-snug">
        Order by {lastDay(campaign)}. Free delivery over {formatFreeShippingMinimumLabel()}, or free pickup in Spintex.
      </p>
    </div>
  )
}

/** One line in the bag while the campaign runs. */
export function CampaignCartNote() {
  const { campaign, state } = useCampaign()
  if (!campaign || state !== "live") return null
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] text-mute">
      <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-extrabold tracking-[0.08em] text-white uppercase">
        {campaign.name}
      </span>
      Ends {lastDay(campaign)} at midnight.
    </p>
  )
}
