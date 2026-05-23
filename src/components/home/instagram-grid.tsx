"use client"

import { motion } from "framer-motion"
import { Camera } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { cn } from "@/lib/utils"
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand"

const tiles = [
  "from-rose-300 via-pink-200 to-rose-100",
  "from-fuchsia-300 via-purple-200 to-pink-100",
  "from-amber-200 via-orange-100 to-yellow-50",
  "from-violet-300 via-indigo-200 to-blue-100",
  "from-emerald-200 via-teal-100 to-cyan-50",
  "from-rose-200 via-red-100 to-orange-50",
]

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
}

const pop = {
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
}

export function InstagramGrid() {
  return (
    <Section>
      <Container>
        <Heading
          as="h2"
          subtitle="Join our community of confident women"
          align="center"
        >
          Follow {INSTAGRAM_HANDLE}
        </Heading>

        <motion.div
          variants={stagger}
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6"
        >
          {tiles.map((gradient, i) => (
            <motion.a
              key={i}
              variants={pop}
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy/0 transition-colors duration-300 group-hover:bg-navy/30">
                <Camera className="size-6 text-white opacity-0 transition-all duration-300 group-hover:opacity-100" />
                <span className="mt-1 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:opacity-100">
                  View Post
                </span>
              </div>
            </motion.a>
          ))}
        </motion.div>
      </Container>
    </Section>
  )
}
