"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Briefcase, Heart, Sun, Gift, Sparkles, Moon, Baby, Flower2 } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { occasions as staticOccasions } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type Occasion = {
  id: string
  name: string
  slug: string
  image: string
  description: string
}

const iconMap: Record<string, typeof Briefcase> = {
  work: Briefcase,
  wedding: Heart,
  weekend: Sun,
  gifting: Gift,
  "morning-routine": Sun,
  "night-repair": Moon,
  "body-care": Sparkles,
  "lip-care": Flower2,
  baby: Baby,
}

const gradientMap: Record<string, string> = {
  work: "from-[#1c3a2c] via-[#244b39] to-[#2f5f49]",
  wedding: "from-[#244b39] via-[#b6946d] to-[#f7f3ed]",
  weekend: "from-[#b6946d] via-[#c9ae8f] to-[#e4d5c3]",
  gifting: "from-[#244b39] via-[#5a8a70] to-[#b6946d]",
  "morning-routine": "from-[#b6946d] via-[#c9ae8f] to-[#f7f3ed]",
  "night-repair": "from-[#10231a] via-[#244b39] to-[#2f5f49]",
  "body-care": "from-[#244b39] via-[#2f5f49] to-teal-light",
  "lip-care": "from-[#244b39] via-[#b6946d] to-[#c9ae8f]",
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const fadeUp = {
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}

export function ShopByOccasion() {
  const [occasions, setOccasions] = useState<Occasion[]>(staticOccasions as Occasion[])

  useEffect(() => {
    fetch("/api/storefront/occasions")
      .then((res) => res.json())
      .then((data: Occasion[]) => {
        if (Array.isArray(data) && data.length > 0) setOccasions(data)
      })
      .catch(() => {})
  }, [])

  return (
    <Section>
      <Container>
        <Heading
          as="h2"
          subtitle="Find the perfect look for every moment"
          align="center"
        >
          Shop by Occasion
        </Heading>

        <motion.div
          variants={stagger}
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
        >
          {occasions.map((occasion) => {
            const Icon = iconMap[occasion.slug] ?? iconMap.work
            const gradient = gradientMap[occasion.slug] ?? "from-slate-700 via-slate-600 to-slate-500"

            return (
              <motion.div key={occasion.id} variants={fadeUp}>
                <Link href={`/shop?occasion=${occasion.slug}`} className="group block">
                  <div
                    className={cn(
                      "relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br transition-all duration-500",
                      "luxury-shadow hover:luxury-shadow-lg hover:scale-[1.02]",
                      gradient,
                    )}
                  >
                    <div className="absolute inset-0 bg-black/5 transition-colors duration-500 group-hover:bg-black/10" />
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]" />

                    <div className="relative flex h-full flex-col items-center justify-center p-6 text-center text-white">
                      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                        <Icon className="size-7" strokeWidth={1.5} />
                      </div>
                      <h3 className="font-heading text-xl font-semibold">{occasion.name}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                        {occasion.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </Container>
    </Section>
  )
}
