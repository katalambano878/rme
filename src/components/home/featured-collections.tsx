"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Heart, ShoppingBag, Eye } from "lucide-react"
import { Heading } from "@/components/shared/heading"
import type { Product } from "@/types/product"
import { cn, formatPrice } from "@/lib/utils"
import { getProductPrimaryImageUrl } from "@/lib/product-image"

const tabs = [
  { id: "new-arrivals", label: "Featured Products" },
  { id: "best-sellers", label: "Top Selling" },
] as const

export type FeaturedCollectionsProps = {
  newArrivals: Product[]
  curatedPicks: Product[]
}

function getTabProducts(
  id: string,
  data: FeaturedCollectionsProps,
): Product[] {
  switch (id) {
    case "new-arrivals":
      return data.newArrivals.slice(0, 4)
    case "best-sellers":
      return data.curatedPicks.slice(0, 4)
    default:
      return []
  }
}

export function FeaturedCollections({
  newArrivals,
  curatedPicks,
}: FeaturedCollectionsProps) {
  const [activeTab, setActiveTab] = useState<string>("new-arrivals")
  const activeProducts = getTabProducts(activeTab, {
    newArrivals,
    curatedPicks,
  })

  return (
    <>
      <Heading
        as="h2"
        subtitle="Handpicked selections updated every week"
        align="center"
      >
        Featured Collections
      </Heading>

      <div className="mb-10 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-rose-border/70 bg-[#F8F4F6] p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:text-[1.05rem]",
                activeTab === tab.id
                  ? "bg-rose-100 text-navy shadow-md shadow-rose-200/40"
                  : "text-navy/70 hover:text-navy",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        >
          {activeProducts.map((product, i) => (
            <motion.div
              key={product.id}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
            >
              <FeaturedProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function FeaturedProductCard({ product }: { product: Product }) {
  const category = product.categoryName?.trim() || "Cleanser"
  const image = getProductPrimaryImageUrl(product)
  const amount = product.salePrice ?? product.price

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block min-h-[330px] overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_38px_-16px_rgba(15,23,42,0.45)] sm:min-h-[480px] lg:min-h-[560px]"
    >
      <div className="relative h-[210px] overflow-hidden bg-[#E9E7E3] sm:h-[300px] lg:h-[400px]">
        <img
          src={image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading="lazy"
        />

        <div className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm sm:right-3 sm:top-3 sm:size-9">
          <Heart className="size-3.5 sm:size-4" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center pb-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-primary shadow-xl sm:px-6 sm:py-3 sm:text-lg">
            <ShoppingBag className="size-3.5 sm:size-4" />
            Add to Bag
          </span>
        </div>
      </div>

      <div className="min-h-[120px] bg-[#FFF5F5] px-3 pb-3 pt-3 sm:min-h-[150px] sm:px-5 sm:pb-5 sm:pt-7 lg:min-h-[170px]">
        <span className="inline-flex max-w-full truncate rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-primary sm:px-2.5 sm:text-[12px]">
          {category}
        </span>
        <h3 className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-tight tracking-tight text-navy sm:mt-2.5 sm:text-[17px]">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-1 sm:mt-3.5">
          <p className="text-[13px] font-semibold leading-none text-rose-primary sm:text-[19px]">
            {formatPrice(amount)}
          </p>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-primary sm:size-8">
            <Eye className="size-3.5 sm:size-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
