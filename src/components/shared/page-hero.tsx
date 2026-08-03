"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { Container } from "@/components/shared/container"
import { cn } from "@/lib/utils"

export type PageHeroProps = {
  imageSrc: string
  imageAlt: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  align?: "center" | "left"
  eyebrow?: string
  className?: string
  topContent?: React.ReactNode
  children?: React.ReactNode
}

export function PageHero({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  align = "center",
  eyebrow,
  className,
  topContent,
  children,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden py-20 sm:py-28",
        className
      )}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/25"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20"
        aria-hidden
      />

      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className={cn(align === "center" && "mx-auto max-w-3xl text-center")}
        >
          {topContent}
          {eyebrow ? (
            <p className="text-sm font-medium uppercase tracking-widest text-rose-soft">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-heading text-4xl font-semibold tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl",
              (eyebrow || topContent) && "mt-4"
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "mt-4 text-base text-white/90 sm:mt-6 sm:text-lg [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]",
                align === "center" && "mx-auto max-w-2xl"
              )}
            >
              {subtitle}
            </p>
          ) : null}
          {children}
        </motion.div>
      </Container>
    </section>
  )
}
