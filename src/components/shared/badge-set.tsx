"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProductBadge } from "@/types/product"

const badgeStyles: Record<ProductBadge, string> = {
  New: "bg-brand text-white",
  "Best Seller": "bg-white text-ink",
  Limited: "bg-[#FFF4D6] text-[#6B4A00]",
  Sale: "bg-brand text-white",
}

const badgeLabels: Record<ProductBadge, string> = {
  New: "New",
  "Best Seller": "Best seller",
  Limited: "Limited",
  Sale: "Sale",
}

interface BadgeSetProps {
  badges: ProductBadge[]
  className?: string
  discountPercent?: number
}

const base = "h-auto rounded-lg border-0 px-2 py-1 text-[13px] font-bold"

export function BadgeSet({ badges, className, discountPercent }: BadgeSetProps) {
  const hasDiscount = discountPercent !== undefined && discountPercent > 0
  const filteredBadges = hasDiscount ? badges.filter((b) => b !== "Sale") : badges

  if (!filteredBadges.length && !hasDiscount) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {hasDiscount && (
        <Badge className={cn(base, "bg-brand text-white")}>
          Save {discountPercent}%
        </Badge>
      )}
      {filteredBadges.map((badge) => (
        <Badge key={badge} className={cn(base, badgeStyles[badge])}>
          {badgeLabels[badge]}
        </Badge>
      ))}
    </div>
  )
}
