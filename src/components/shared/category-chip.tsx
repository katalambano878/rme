"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CategoryChipProps {
  name: string
  slug: string
  className?: string
}

export function CategoryChip({ name, slug, className }: CategoryChipProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/shop?category=${slug}`}
        className={cn(
          "inline-flex items-center rounded-full border border-rose-border bg-white px-5 py-2 text-sm font-medium text-navy transition-colors hover:border-rose-primary/30 hover:bg-rose-light hover:text-rose-primary",
          className
        )}
      >
        {name}
      </Link>
    </motion.div>
  )
}
