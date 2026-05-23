"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

const sizeMap: Record<HeadingLevel, string> = {
  h1: "text-4xl sm:text-5xl lg:text-6xl",
  h2: "text-3xl sm:text-4xl lg:text-5xl",
  h3: "text-2xl sm:text-3xl",
  h4: "text-xl sm:text-2xl",
  h5: "text-lg sm:text-xl",
  h6: "text-base sm:text-lg",
}

interface HeadingProps {
  as?: HeadingLevel
  children: React.ReactNode
  className?: string
  subtitle?: string
  align?: "left" | "center"
}

export function Heading({
  as: Tag = "h2",
  children,
  className,
  subtitle,
  align = "left",
}: HeadingProps) {
  return (
    <motion.div
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
      className={cn(align === "center" && "text-center")}
    >
      <Tag
        className={cn(
          "font-heading font-semibold tracking-tight text-navy",
          sizeMap[Tag],
          className
        )}
      >
        {children}
      </Tag>
      {subtitle && (
        <p
          className={cn(
            "mt-3 max-w-2xl text-base text-muted-foreground sm:mt-4 sm:text-lg",
            align === "center" && "mx-auto"
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
