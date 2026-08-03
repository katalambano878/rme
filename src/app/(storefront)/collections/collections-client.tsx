"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Container } from "@/components/shared/container"
import { Heading } from "@/components/shared/heading"
import { CategoryCard } from "@/components/shared/category-card"
import type { StorefrontCategory } from "@/lib/data/storefront-products"

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

        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category, idx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.5 }}
            >
              <CategoryCard
                name={category.displayName}
                slug={category.slug}
                imageUrl={category.image_url}
              />
            </motion.div>
          ))}
        </div>
      </Container>
    </div>
  )
}
