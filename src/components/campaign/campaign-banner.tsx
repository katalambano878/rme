"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { hasDiscount, lastDay, offerLine, shopDay, useCampaign } from "./campaign-context"
import { CountdownBoxes } from "./countdown-boxes"
import { cn, formatFreeShippingMinimumLabel } from "@/lib/utils"

/**
 * The black Black Friday strip for the top of the shop pages, matching the
 * home hero. Shows only while the campaign is live or in its teaser week.
 */
export function CampaignBanner({ className }: { className?: string; compact?: boolean }) {
  const { campaign, state, remainingMs } = useCampaign()
  if (!campaign || (state !== "live" && state !== "upcoming")) return null
  const live = state === "live"
  const discount = hasDiscount(campaign)

  return (
    <section
      aria-label={campaign.name}
      className={cn("overflow-hidden rounded-2xl bg-ink px-5 py-5 text-white sm:px-7 sm:py-6", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span className="rounded-md bg-brand px-2 py-0.5 tracking-[0.08em] uppercase">{campaign.name}</span>
            <span className="text-white/70">
              {live ? `On now · until ${lastDay(campaign)}` : `Starts ${shopDay(campaign.startsAt)}`}
            </span>
          </p>
          <h2 className="mt-2 text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-balance sm:text-[32px]">
            {campaign.message || offerLine(campaign)}
          </h2>
          <p className="mt-1 text-[15px] text-white/70">
            {discount
              ? "Applied automatically, no code needed."
              : `Delivery anywhere in Ghana, free over ${formatFreeShippingMinimumLabel()}.`}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <CountdownBoxes ms={remainingMs} size="sm" />
          <Link
            href={discount && live ? "/shop?sale=1" : "/#black-friday-edit"}
            className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-blush-deep hover:text-white"
          >
            See the {campaign.name} edit
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
