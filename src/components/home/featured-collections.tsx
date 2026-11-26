"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { Product } from "@/types/product"
import { ProductCard } from "@/components/shared/product-card"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "new", label: "New in", href: "/shop" },
  { id: "top", label: "Top selling", href: "/shop" },
] as const

type TabId = (typeof tabs)[number]["id"]

export type FeaturedCollectionsProps = {
  newArrivals: Product[]
  curatedPicks: Product[]
}

/**
 * Home page picks: one heading, two pill tabs and the same product tiles the
 * shop uses, so every card can go straight into the bag.
 */
export function FeaturedCollections({ newArrivals, curatedPicks }: FeaturedCollectionsProps) {
  const [active, setActive] = useState<TabId>("new")
  const products = (active === "new" ? newArrivals : curatedPicks).slice(0, 8)
  const tab = tabs.find((t) => t.id === active)!

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[34px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">
            Featured collections
          </h2>
          <p className="mt-1 text-[16px] text-mute">Handpicked every week from what&apos;s new and what customers love.</p>
        </div>
        <Link
          href={tab.href}
          className="inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-raspberry hover:text-raspberry-deep"
        >
          See all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div role="tablist" aria-label="Featured collections" className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            onClick={() => setActive(t.id)}
            className={cn(
              "min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors",
              t.id === active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:bg-counter",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-[16px] text-mute">New picks are on their way.</p>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
