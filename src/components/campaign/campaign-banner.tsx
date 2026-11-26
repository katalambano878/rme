"use client"

import Link from "next/link"
import { formatCountdown, hasDiscount, lastDay, offerLine, shopDay, useCampaign } from "./campaign-context"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"
import { cn } from "@/lib/utils"

/**
 * A wide Black Friday banner for the top of the home and shop pages. Shows
 * only while the campaign is live or starting within a week.
 */
export function CampaignBanner({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { campaign, state, remainingMs } = useCampaign()
  if (!campaign || (state !== "live" && state !== "upcoming")) return null
  const live = state === "live"
  const discount = hasDiscount(campaign)

  return (
    <section
      aria-label={campaign.name}
      className={cn(
        "rounded-2xl border border-blush-deep bg-blush text-ink",
        compact ? "px-5 py-5 sm:px-7" : "px-6 py-8 sm:px-10 sm:py-10",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span className="rounded-md bg-ink px-2 py-0.5 tracking-[0.08em] text-white uppercase">{campaign.name}</span>
            <span className="text-raspberry">{live ? "On now" : `Starts ${shopDay(campaign.startsAt)}`}</span>
          </p>
          <h2
            className={cn(
              "mt-1.5 font-extrabold tracking-[-0.03em] text-balance",
              compact ? "text-[26px] leading-tight sm:text-[32px]" : "text-[34px] leading-[1.05] sm:text-[48px]",
            )}
          >
            {campaign.message || offerLine(campaign)}
          </h2>
          <p className="mt-2 max-w-xl text-[15px] text-mute">
            {discount
              ? "Applied automatically, no code needed. Items already on sale get whichever price is lower."
              : `Stock up on your favourites and gift sets. Delivery anywhere in Ghana, free over ${formatFreeShippingMinimumLabel()}.`}{" "}
            {live ? `Ends ${lastDay(campaign)}.` : ""}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="text-sm text-mute">
            {live ? "Ends in" : "Starts in"}{" "}
            <span className="ml-1 rounded-md bg-white px-2 py-1 text-base font-bold text-ink tabular-nums" suppressHydrationWarning>
              {formatCountdown(remainingMs)}
            </span>
          </p>
          {live ? (
            <Link
              href={discount ? "/shop?sale=1" : "/shop"}
              className="inline-flex min-h-12 items-center rounded-xl bg-brand px-6 text-base font-bold text-white transition-colors hover:bg-brand-deep"
            >
              {discount ? "Shop the deals" : "Shop now"}
            </Link>
          ) : (
            <Link
              href="/shop"
              className="inline-flex min-h-12 items-center rounded-xl border-2 border-brand bg-white px-6 text-base font-bold text-ink transition-colors hover:bg-brand hover:text-white"
            >
              {discount ? "Browse now, buy on the day" : "Browse the shop"}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
