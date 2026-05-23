"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

interface PromoBannerProps {
  title: string
  subtitle?: string
  ctaText?: string
  ctaHref?: string
  className?: string
}

export function PromoBanner({
  title,
  subtitle,
  ctaText = "Shop Now",
  ctaHref = "/shop",
  className,
}: PromoBannerProps) {
  return (
    <motion.div
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
      className={cn(
        "luxury-gradient overflow-hidden rounded-2xl border border-rose-border px-6 py-10 sm:rounded-3xl sm:px-12 sm:py-14",
        className
      )}
    >
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="font-heading text-2xl font-semibold text-navy sm:text-3xl lg:text-4xl">
          {title}
        </h3>
        {subtitle && (
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground sm:mt-4 sm:text-lg">
            {subtitle}
          </p>
        )}
        {ctaText && (
          <Link
            href={ctaHref}
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3 text-sm font-medium text-white transition-all hover:bg-navy-light sm:mt-8"
          >
            {ctaText}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}
