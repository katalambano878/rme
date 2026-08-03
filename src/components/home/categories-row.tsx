import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { CategoryCard } from "@/components/shared/category-card"
import type { StorefrontCategory } from "@/lib/data/storefront-products"

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
              <span className="bg-gradient-to-r from-[#244b39] via-[#b6946d] to-[#f7f3ed] bg-clip-text text-transparent">
                Category
              </span>
            </h2>
          </div>
          <Link
            href="/collections"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-5 py-2.5 font-sans text-sm font-bold text-navy shadow-sm transition-colors hover:bg-gray-50 sm:self-auto sm:py-3 sm:text-base"
          >
            Explore All
            <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-rose-border/50 bg-rose-light p-12 text-center text-sm text-muted-foreground">
            No categories yet. Add categories in the admin dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 sm:gap-y-9 lg:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                name={category.displayName}
                slug={category.slug}
                imageUrl={category.image_url}
              />
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
