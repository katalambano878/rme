"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, Gift, Smartphone, Store, Truck } from "lucide-react"
import type { Product } from "@/types/product"
import { formatFreeShippingMinimumLabel, formatPrice } from "@/lib/utils"
import { getProductPrimaryImageUrl, optimizedImageUrl } from "@/lib/product-image"
import { hasDiscount, lastDay, shopDay, useCampaign } from "./campaign-context"
import { CountdownBoxes } from "./countdown-boxes"

const PERKS = [
  { icon: Truck, label: "Delivery across Ghana" },
  { icon: Gift, label: `Free delivery over ${formatFreeShippingMinimumLabel()}` },
  { icon: Store, label: "Free pickup in Spintex" },
  { icon: Smartphone, label: "Pay with Mobile Money" },
]

function Tile({ product, className }: { product: Product; className?: string }) {
  const price = product.salePrice ?? product.price
  return (
    <Link
      href={`/products/${product.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl bg-white text-ink ${className ?? ""}`}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-counter">
        <img
          src={optimizedImageUrl(getProductPrimaryImageUrl(product), 520)}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 px-3.5 py-3">
        <span className="line-clamp-1 text-[14px] font-semibold">{product.name}</span>
        <span className="shrink-0 text-[14px] font-extrabold tabular-nums">{formatPrice(price)}</span>
      </div>
    </Link>
  )
}

/**
 * Takes over the home hero while the campaign is live or in its teaser week:
 * full-width black stage, huge type, segmented countdown, real products and
 * her perks. Outside the campaign it renders the normal hero (children).
 */
export function CampaignHero({ products, children }: { products: Product[]; children: ReactNode }) {
  const { campaign, state, remainingMs } = useCampaign()
  if (!campaign || (state !== "live" && state !== "upcoming")) return <>{children}</>

  const live = state === "live"
  const discount = hasDiscount(campaign)
  const tiles = products.filter((p) => p.images?.length).slice(0, 3)
  const dates = `${shopDay(campaign.startsAt)} – ${lastDay(campaign)}`
  const headline = discount ? `${campaign.discountPercent}% off everything` : campaign.message || "The weekend to stock up."

  return (
    <section aria-label={campaign.name} className="relative isolate overflow-hidden bg-ink text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:py-20">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-bold sm:text-sm">
            <span className="rounded-md bg-brand px-2.5 py-1 tracking-[0.1em] uppercase">
              {live ? "On now" : `Starts ${shopDay(campaign.startsAt)}`}
            </span>
            <span className="text-white/70">{dates}</span>
          </p>

          <h1 className="mt-5 text-[64px] leading-[0.88] font-extrabold tracking-[-0.045em] uppercase sm:text-[104px] xl:text-[132px]">
            Black
            <br />
            <span className="text-blush-deep">Friday</span>
          </h1>
          {campaign.name.toLowerCase() !== "black friday" && (
            <p className="mt-3 text-lg font-bold text-white/80">{campaign.name}</p>
          )}

          <p className="mt-6 max-w-xl text-[22px] leading-snug font-bold text-balance sm:text-[28px]">{headline}</p>
          <p className="mt-2 max-w-lg text-[16px] leading-relaxed text-white/70">
            {discount
              ? "Applied automatically at checkout, no code needed."
              : "Gift sets, scents and your skincare favourites, ready for the season."}
          </p>

          <div className="mt-8">
            <p className="mb-2.5 text-[13px] font-semibold tracking-[0.12em] text-white/60 uppercase">
              {live ? "Ends in" : "Starts in"}
            </p>
            <CountdownBoxes ms={remainingMs} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={discount && live ? "/shop?sale=1" : "#black-friday-edit"}
              className="inline-flex min-h-13 items-center gap-2 rounded-xl bg-brand px-7 text-[17px] font-bold text-white transition-colors hover:bg-brand-deep"
            >
              {live ? "Shop the edit" : "Preview the edit"}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/shop?category=skin-care-set"
              className="inline-flex min-h-13 items-center rounded-xl px-6 text-[17px] font-bold text-white ring-2 ring-white/30 transition-colors hover:bg-white hover:text-ink"
            >
              Gift sets
            </Link>
          </div>
        </div>

        {tiles.length >= 3 && (
          <div className="grid h-[420px] grid-cols-2 grid-rows-2 gap-3 sm:h-[520px] sm:gap-4">
            <Tile product={tiles[0]} className="row-span-2" />
            <Tile product={tiles[1]} />
            <Tile product={tiles[2]} />
          </div>
        )}
      </div>

      <ul className="m-0 grid list-none grid-cols-2 border-t border-white/10 p-0 lg:grid-cols-4">
        {PERKS.map(({ icon: Icon, label }, i) => (
          <li
            key={label}
            className={`flex items-center gap-3 px-4 py-4 text-[14px] font-semibold text-white/85 sm:px-6 lg:justify-center ${
              i % 2 === 0 ? "border-r border-white/10" : ""
            } ${i < 2 ? "border-b border-white/10 lg:border-b-0" : ""} lg:border-r lg:last:border-r-0`}
          >
            <Icon className="size-5 shrink-0 text-blush-deep" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}
