import Link from "next/link"
import { cn } from "@/lib/utils"
import { MOCK_PRODUCT_IMAGE } from "@/lib/product-image"

export type CategoryCardProps = {
  name: string
  slug: string
  imageUrl?: string | null
  badge?: string
  className?: string
}

const BADGE_BY_SLUG: Record<string, string> = {
  featured: "FEATURED",
  "new-arrivals": "NEW",
  "best-sellers": "BEST",
  sale: "PRE-ORDER",
  preorders: "PRE-ORDER",
}

function badgeForSlug(slug: string, override?: string) {
  if (override) return override
  return BADGE_BY_SLUG[slug] ?? "SHOP"
}

export function CategoryCard({
  name,
  slug,
  imageUrl,
  badge,
  className,
}: CategoryCardProps) {
  const src = imageUrl?.trim() || MOCK_PRODUCT_IMAGE
  const label = badgeForSlug(slug, badge)
  const isPreorder = label === "PRE-ORDER" || slug === "preorders" || slug === "sale"

  return (
    <Link
      href={`/shop?category=${slug}`}
      className={cn("group block", className)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#EAE8E4]">
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />

        {label ? (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm sm:left-4 sm:top-4 sm:px-3 sm:text-[11px]",
              isPreorder
                ? "bg-rose-primary text-navy"
                : "bg-white text-navy",
            )}
          >
            {label}
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 font-heading text-lg font-medium leading-snug tracking-tight text-navy transition-colors group-hover:text-navy/80 sm:mt-4 sm:text-xl">
        {name}
      </h3>
      {isPreorder ? (
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Reserve now — ships when stock arrives
        </p>
      ) : null}
    </Link>
  )
}
