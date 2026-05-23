"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { ProductCard } from "@/components/shared/product-card"
import type { Product } from "@/types/product"

export type TrendingCarouselProps = {
  products: Product[]
}

export function TrendingCarousel({ products }: TrendingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const trending = products.slice(0, 6)

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    })
  }

  if (trending.length === 0) return null

  return (
    <Section className="overflow-hidden">
      <Container>
        <div className="mb-10 flex items-end justify-between">
          <Heading as="h2" subtitle="What's hot right now" className="mb-0">
            Trending Now
          </Heading>

          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="flex size-10 items-center justify-center rounded-full border border-rose-border transition-colors hover:border-rose-primary/30 hover:bg-rose-light"
            >
              <ChevronLeft className="size-5 text-navy" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="flex size-10 items-center justify-center rounded-full border border-rose-border transition-colors hover:border-rose-primary/30 hover:bg-rose-light"
            >
              <ChevronRight className="size-5 text-navy" />
            </button>
          </div>
        </div>
      </Container>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4 sm:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {trending.map((product, i) => (
              <motion.div
                key={product.id}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
                className="w-[260px] shrink-0 snap-start sm:w-[280px]"
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
