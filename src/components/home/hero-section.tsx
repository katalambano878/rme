"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"

const HERO_SLIDES = [
  {
    src: "/images/home/hero-pink-studio.png",
    alt: "Skincare and beauty display — cleansing pads, sugar lip scrub, and curated pink accessories",
  },
  {
    src: "/images/home/hero-marble-garden.png",
    alt: "Cosmetics on white marble with garden backdrop — lip care, body care, and turmeric skincare",
  },
] as const

const SLIDE_INTERVAL_MS = 3000

export function HeroSection() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % HERO_SLIDES.length)
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section
      className="relative isolate -mt-[4.25rem] min-h-[100svh] min-h-screen w-full overflow-hidden"
      aria-roledescription="carousel"
    >
      <div className="absolute inset-0">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === active ? "z-[1] opacity-100" : "z-0 opacity-0"
            )}
            aria-hidden={i !== active}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Readability: left-side scrim */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-black/60 via-black/25 to-transparent sm:from-black/55"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/40 via-transparent to-black/30"
        aria-hidden
      />

      {/* Slide dots */}
      <div
        className="pointer-events-none absolute bottom-6 left-1/2 z-[12] flex -translate-x-1/2 gap-2 sm:bottom-8"
        aria-hidden
      >
        {HERO_SLIDES.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === active ? "w-6 bg-white" : "w-1.5 bg-white/40"
            )}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] min-h-screen max-w-[1200px] flex-col justify-center px-5 pb-16 pt-[5.5rem] sm:px-8 sm:pb-20 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-32">
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-4 py-2.5 shadow-sm sm:px-5 sm:py-2"
          >
            <Star className="size-[1.125rem] shrink-0 fill-rose-500 text-rose-500 sm:size-5" aria-hidden />
            <span className="font-sans text-[14px] font-semibold tracking-normal text-rose-600 sm:text-[15px]">
              Reveal Your Natural Glow
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06 }}
            className="mt-6 font-heading text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.5)] sm:text-4xl sm:leading-[1.08] lg:text-[2.75rem] lg:leading-[1.06]"
          >
            Glow Starts With Healthy Skin
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 max-w-xl font-sans text-base font-normal leading-relaxed text-white/90 [text-shadow:0_1px_16px_rgba(0,0,0,0.5)] sm:text-[1.125rem] sm:leading-relaxed"
          >
            Discover premium skincare and beauty essentials formulated to nourish, protect, and enhance your natural glow
            every single day.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-6 py-3 font-sans text-sm font-semibold tracking-tight text-navy transition-colors hover:bg-rose-200/90 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Shop Collection
              <ArrowRight className="size-[1.125rem] sm:size-5" aria-hidden />
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center justify-center rounded-full border-2 border-rose-300 bg-white px-6 py-3 font-sans text-sm font-semibold tracking-tight text-rose-600 transition-colors hover:bg-rose-50/80 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Beauty Guide
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
