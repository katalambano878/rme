"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import type { Product } from "@/types/product"
import { ProductCard } from "@/components/shared/product-card"
import { cn } from "@/lib/utils"
import { useCampaign } from "./campaign-context"

export type CampaignEditTab = { label: string; href: string; products: Product[] }

/**
 * "The Black Friday edit": a product row straight after the campaign hero,
 * with tabs for the categories people shop for gifts. Only shows while the
 * campaign is live or in its teaser week.
 */
export function CampaignEdit({ tabs }: { tabs: CampaignEditTab[] }) {
  const { campaign, state } = useCampaign()
  const usable = tabs.filter((t) => t.products.length > 0)
  const [active, setActive] = useState(0)
  if (!campaign || (state !== "live" && state !== "upcoming") || usable.length === 0) return null

  const tab = usable[Math.min(active, usable.length - 1)]

  return (
    <section id="black-friday-edit" aria-labelledby="bf-edit-title" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex rounded-md bg-ink px-2.5 py-1 text-[12px] font-extrabold tracking-[0.1em] text-white uppercase">
              {campaign.name}
            </p>
            <h2 id="bf-edit-title" className="mt-3 text-[34px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[44px]">
              The {campaign.name} edit
            </h2>
            <p className="mt-1 text-[16px] text-mute">Picked by us for gifting and stocking up.</p>
          </div>
          <Link
            href={tab.href}
            className="inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-raspberry hover:text-raspberry-deep"
          >
            See all {tab.label.toLowerCase()}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div role="tablist" aria-label="Edit categories" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {usable.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-5 text-[15px] font-bold transition-colors",
                i === active ? "bg-ink text-white" : "bg-counter text-ink hover:bg-counter-deep",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {tab.products.slice(0, 8).map((p) => (
            <div key={p.id} className="w-[200px] shrink-0 snap-start sm:w-auto">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
