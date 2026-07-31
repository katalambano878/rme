"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Store } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Heading } from "@/components/shared/heading"
import type { StorefrontCategory } from "@/lib/supabase/storefront-products"
import { MOCK_PRODUCT_IMAGE, optimizedImageUrl } from "@/lib/product-image"

export type CollectionsPageClientProps = {
  categories: StorefrontCategory[]
}

export default function CollectionsPageClient({
  categories,
}: CollectionsPageClientProps) {
  return (
    <div className="py-12 sm:py-20">
      <Container>
        <div className="mb-4 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-rose-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Categories</span>
        </div>

        <Heading
          as="h1"
          subtitle={`${categories.length} categories to explore`}
          align="left"
        >
          Categories
        </Heading>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category, idx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.5 }}
            >
              <Link
                href={`/shop?category=${category.slug}`}
                className="group block overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_10px_28px_-20px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-20px_rgba(15,23,42,0.45)]"
              >
                <div className="relative h-[320px] overflow-hidden bg-[#ECECEC]">
                  <img
                    src={optimizedImageUrl(
                      category.image_url?.trim() || MOCK_PRODUCT_IMAGE,
                      640,
                    )}
                    alt={category.displayName}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <div className="relative space-y-6 px-7 pb-7 pt-10">
                  <div className="absolute -top-9 left-7 flex size-[64px] items-center justify-center rounded-2xl border-2 border-rose-100 bg-[#FFF5F5] shadow-[0_10px_24px_-12px_rgba(244,114,182,0.35)]">
                    <Store className="size-6 text-rose-300" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-rose-300 uppercase">
                      CATEGORIES
                    </p>
                    <h3 className="mt-2 font-heading text-[2.05rem] leading-none text-rose-400">
                      {category.displayName}
                    </h3>
                    <p className="mt-5 text-[1.08rem] leading-relaxed text-rose-300/90">
                      {category.description?.trim() ||
                        "Explore our exclusive categories in this section."}
                    </p>
                  </div>

                  <div className="h-px bg-rose-100" />

                  <div className="flex items-center justify-between">
                    <span className="text-[1.08rem] font-semibold tracking-wide text-rose-400 uppercase">
                      Browse
                    </span>
                    <span className="flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-300 transition-all group-hover:bg-rose-200 group-hover:text-rose-400">
                      <ArrowRight className="size-5" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </Container>
    </div>
  )
}
