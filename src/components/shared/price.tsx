"use client"

import { cn, formatPrice } from "@/lib/utils"

interface PriceProps {
  amount: number
  salePrice?: number
  className?: string
  size?: "sm" | "md" | "lg"
}

const nowSize = {
  sm: "text-[19px]",
  md: "text-[22px]",
  lg: "text-[30px] sm:text-[34px]",
}

const wasSize = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-lg",
}

/** Price with the old price struck through when on sale. Sale prices are raspberry. */
export function Price({ amount, salePrice, className, size = "md" }: PriceProps) {
  const hasSale = salePrice !== undefined && salePrice > 0 && salePrice < amount
  if (!hasSale && !(amount > 0)) return null

  return (
    <p className={cn("m-0 flex flex-wrap items-baseline gap-x-2 tabular-nums", className)}>
      <span className={cn("font-extrabold tracking-tight", nowSize[size], hasSale ? "text-raspberry" : "text-ink")}>
        {hasSale && <span className="sr-only">Now </span>}
        {formatPrice(hasSale ? salePrice : amount)}
      </span>
      {hasSale && (
        <s className={cn("font-medium text-mute", wasSize[size])}>
          <span className="sr-only">Was </span>
          {formatPrice(amount)}
        </s>
      )}
    </p>
  )
}

/** Whole-number percentage saved, or undefined when the product isn't on sale. */
export function savePercent(amount: number, salePrice?: number): number | undefined {
  if (salePrice === undefined || !(salePrice > 0) || !(amount > 0) || salePrice >= amount) return undefined
  const pct = Math.round((1 - salePrice / amount) * 100)
  return pct > 0 ? pct : undefined
}
