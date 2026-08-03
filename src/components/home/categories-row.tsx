import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import type { StorefrontCategory } from "@/lib/data/storefront-products"
import { MOCK_PRODUCT_IMAGE } from "@/lib/product-image"

export type CategoriesRowProps = {
  categories: StorefrontCategory[]
}

export function CategoriesRow({ categories }: CategoriesRowProps) {
  return (
    <Section className="bg-white pb-24 pt-20 sm:pb-32 sm:pt-28">
      <Container>
        <div className="mb-14 flex flex-col gap-6 sm:mb-16 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0 max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-gray-200/90 bg-gray-50 px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-600 sm:text-[11px]">
              Collections
            </span>
            <h2 className="mt-4 font-sans text-4xl font-bold leading-[1.1] tracking-tight sm:mt-5 sm:text-5xl lg:text-6xl">
              <span className="text-navy">Shop by </span>
            <span className="bg-gradient-to-r from-[#be185d] via-[#fb7185] to-[#fff1f2] bg-clip-text text-transparent">
              Category
            </span>
            </h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-5 py-2.5 font-sans text-sm font-bold text-navy shadow-sm transition-colors hover:bg-gray-50 sm:self-auto sm:py-3 sm:text-base"
          >
            Explore All
            <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-rose-border/50 bg-rose-50/30 p-12 text-center text-sm text-muted-foreground">
            No categories yet. Add categories in the admin dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-7 lg:grid-cols-4 lg:gap-6">
            {categories.map((category) => {
              const imageSrc = category.image_url?.trim() || MOCK_PRODUCT_IMAGE
              return (
                <Link
                  key={category.id}
                  href={`/shop?category=${category.slug}`}
                  className="group relative flex h-auto flex-col overflow-hidden rounded-3xl bg-white shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_34px_-16px_rgba(15,23,42,0.38)]"
                >
                  <div className="pointer-events-none absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/30 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 sm:right-4 sm:top-4 sm:size-9">
                    <ArrowRight className="size-3.5 sm:size-4" />
                  </div>

                  {/* Top image zone */}
                  <div className="relative h-[200px] overflow-hidden bg-[#EAE8E4] sm:h-[260px] lg:h-[320px]">
                    <img
                      src={imageSrc}
                      alt={category.displayName}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  </div>

                  {/* Bottom copy zone — tight stack, no stretched middle gap */}
                  <div className="flex flex-col gap-2 bg-[#FFF5F5] px-3.5 py-3 text-left sm:gap-2 sm:px-6 sm:py-3.5">
                    <div>
                      <h3 className="font-sans text-[13px] font-semibold leading-tight tracking-tight text-navy sm:text-[15px]">
                        {category.displayName}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-normal leading-snug text-navy/60 sm:mt-1 sm:text-[13px]">
                        Discover the collection
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-rose-primary transition-colors group-hover:text-rose-primary/85 sm:text-[14px]">
                      Explore Collection
                      <ArrowRight className="size-3 shrink-0 sm:size-3.5" strokeWidth={2.25} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Container>
    </Section>
  )
}

