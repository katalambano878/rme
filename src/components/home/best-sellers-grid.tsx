"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { ProductCard } from "@/components/shared/product-card"
import type { Product } from "@/types/product"

export type BestSellersGridProps = {
  products: Product[]
}

export function BestSellersGrid({ products }: BestSellersGridProps) {
  const list = products.slice(0, 8)

  if (list.length === 0) return null

  return (
    <Section>
      <Container>
        <Heading
          as="h2"
          subtitle="The pieces our customers can't stop raving about"
          align="center"
        >
          What Our Customers Love
        </Heading>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {list.map((product, i) => (
            <motion.div
              key={product.id}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                delay: i * 0.06,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>

        <motion.div
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 flex justify-center"
        >
          <Link
            href="/shop?filter=best-sellers"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-rose-primary transition-colors hover:text-rose-primary/80"
          >
            View All Best Sellers
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </Container>
    </Section>
  )
}
