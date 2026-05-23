"use client"

import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/utils"

interface PriceProps {
  amount: number
  salePrice?: number
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg sm:text-xl",
}

export function Price({ amount, salePrice, className, size = "md" }: PriceProps) {
  const hasSale = salePrice !== undefined && salePrice < amount

  return (
    <div className={cn("flex items-baseline gap-2", sizeClasses[size], className)}>
      <span
        className={cn(
          "font-semibold",
          hasSale ? "text-rose-primary" : "text-navy"
        )}
      >
        {formatPrice(hasSale ? salePrice : amount)}
      </span>
    </div>
  )
}
