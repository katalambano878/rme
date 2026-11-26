"use client"

import { useState, useMemo, useId } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal, X } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import type { Product } from "@/types/product"
import type { StorefrontCategory } from "@/lib/supabase/storefront-products"
import { QuickViewModal } from "@/components/shared/quick-view-modal"
import { ProductCard } from "@/components/shared/product-card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useListPositionMemory } from "@/lib/hooks/use-list-position-memory"
import { useCampaign } from "@/components/campaign/campaign-context"
import { CampaignBanner } from "@/components/campaign/campaign-banner"

const ITEMS_PER_PAGE = 24
const CATEGORY_PREVIEW = 10

const sortOptions = [
  { value: "best-sellers", label: "Best sellers" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
  { value: "top-rated", label: "Top rated" },
] as const

const MIN_PRICE = 0

export type ShopPageClientProps = {
  products: Product[]
  categories: StorefrontCategory[]
  maxPrice: number
  initialCategory?: string
}

export default function ShopPageClient({
  products,
  categories,
  maxPrice,
  initialCategory,
}: ShopPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const sortId = useId()
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    initialCategory ? [initialCategory] : [],
  )
  const [priceRange, setPriceRange] = useState<number[]>([
    MIN_PRICE,
    maxPrice,
  ])
  const [sort, setSort] = useState<string>("best-sellers")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  // /shop?sale=1 (navbar "Sale") shows only products with an active sale price.
  const saleOnly = searchParams.get("sale") === "1"
  const { campaign, state: campaignStateNow } = useCampaign()
  const campaignLive = campaignStateNow === "live"
  // /shop?q=term (search box Enter) narrows the list to matching names.
  const searchTerm = (searchParams.get("q") ?? "").trim().toLowerCase()

  // ?category= and ?filter=best-sellers in the URL win over the current
  // selection (and over a restored one, which is why restore re-applies them).
  const applyUrlFilters = () => {
    const cat = searchParams.get("category")
    if (cat) {
      setSelectedCategories([cat.toLowerCase()])
    }
    const filter = searchParams.get("filter")
    if (filter === "best-sellers") setSort("best-sellers")
  }

  // Re-sync derived state when its inputs change, during render rather than
  // in an effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [syncedMaxPrice, setSyncedMaxPrice] = useState(maxPrice)
  if (syncedMaxPrice !== maxPrice) {
    setSyncedMaxPrice(maxPrice)
    setPriceRange([MIN_PRICE, maxPrice])
  }
  const [syncedParams, setSyncedParams] = useState<typeof searchParams | null>(null)
  if (syncedParams !== searchParams) {
    setSyncedParams(searchParams)
    applyUrlFilters()
  }

  useListPositionMemory(
    `shop-position:${searchParams.toString()}`,
    { selectedCategories, sort, inStockOnly, visibleCount },
    (saved) => {
      if (Array.isArray(saved.selectedCategories)) setSelectedCategories(saved.selectedCategories)
      if (typeof saved.sort === "string") setSort(saved.sort)
      if (typeof saved.inStockOnly === "boolean") setInStockOnly(saved.inStockOnly)
      if (typeof saved.visibleCount === "number" && saved.visibleCount > ITEMS_PER_PAGE) {
        setVisibleCount(saved.visibleCount)
      }
      applyUrlFilters()
    },
  )

  const filteredProducts = useMemo(() => {
    let result = [...products]

    if (selectedCategories.length > 0) {
      const selected = new Set(selectedCategories.map((s) => s.toLowerCase()))
      result = result.filter((p) =>
        selected.has((p.categorySlug ?? "").toLowerCase()),
      )
    }

    result = result.filter((p) => {
      const price = p.salePrice ?? p.price
      return price >= priceRange[0] && price <= priceRange[1]
    })

    if (inStockOnly) {
      result = result.filter((p) => p.stock > 0)
    }

    if (searchTerm) {
      result = result.filter((p) =>
        `${p.name} ${p.categoryName}`.toLowerCase().includes(searchTerm),
      )
    }

    if (saleOnly) {
      result = result.filter(
        (p) => p.salePrice !== undefined && p.salePrice < p.price,
      )
    }

    switch (sort) {
      case "best-sellers":
        result.sort((a, b) => {
          if (a.isBestSeller !== b.isBestSeller) {
            return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0)
          }
          return b.reviewCount - a.reviewCount
        })
        break
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        break
      case "price-low":
        result.sort(
          (a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price),
        )
        break
      case "price-high":
        result.sort(
          (a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price),
        )
        break
      case "top-rated":
        result.sort((a, b) => b.rating - a.rating)
        break
    }

    return result
  }, [
    products,
    selectedCategories,
    priceRange,
    sort,
    inStockOnly,
    saleOnly,
    searchTerm,
  ])

  const displayedProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  const activeCategoryName =
    selectedCategories.length === 1
      ? categories.find(
          (c) => c.slug.toLowerCase() === selectedCategories[0],
        )?.name
      : null

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    priceRange[0] > MIN_PRICE ||
    priceRange[1] < maxPrice ||
    inStockOnly ||
    saleOnly

  function toggleCategory(slug: string) {
    const key = slug.toLowerCase()
    setSelectedCategories((prev) =>
      prev.includes(key)
        ? prev.filter((s) => s !== key)
        : [...prev, key],
    )
    setVisibleCount(ITEMS_PER_PAGE)
  }

  function clearFilters() {
    setSelectedCategories([])
    setPriceRange([MIN_PRICE, maxPrice])
    setInStockOnly(false)
    setSort("best-sellers")
    setVisibleCount(ITEMS_PER_PAGE)
    if (saleOnly) setSaleOnly(false)
  }

  function setSaleOnly(on: boolean) {
    const next = new URLSearchParams(searchParams.toString())
    if (on) next.set("sale", "1")
    else next.delete("sale")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    setVisibleCount(ITEMS_PER_PAGE)
  }

  function setPriceBound(index: 0 | 1, raw: string) {
    const fallback = index === 0 ? MIN_PRICE : maxPrice
    const n = raw.trim() === "" ? fallback : Number(raw)
    if (!Number.isFinite(n)) return
    const clamped = Math.min(Math.max(n, MIN_PRICE), maxPrice)
    setPriceRange((prev) => (index === 0 ? [clamped, prev[1]] : [prev[0], clamped]))
    setVisibleCount(ITEMS_PER_PAGE)
  }

  function handleQuickView(product: Product) {
    setQuickViewProduct(product)
    setQuickViewOpen(true)
  }

  const totalCount = products.length
  const topCategories = [...categories]
    .filter((c) => c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 7)
  const sidebarCategories = showAllCategories ? categories : categories.slice(0, CATEGORY_PREVIEW)
  const priceFiltered = priceRange[0] > MIN_PRICE || priceRange[1] < maxPrice
  const activeFilterCount =
    selectedCategories.length + (priceFiltered ? 1 : 0) + (inStockOnly ? 1 : 0) + (saleOnly ? 1 : 0)
  const queryLabel = searchParams.get("q")?.trim()
  const saleTitle = campaignLive && campaign && campaign.discountPercent > 0 ? `${campaign.name} deals` : "On sale"
  const title = queryLabel
    ? `Results for “${queryLabel}”`
    : activeCategoryName ?? (saleOnly ? saleTitle : "Shop all")
  const subtitle = queryLabel || activeCategoryName || saleOnly
    ? `${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`
    : `${totalCount} genuine products, delivered across Accra or ready at Spintex.`

  const checkboxClass = "size-[18px] shrink-0 accent-raspberry"
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
      active ? "bg-brand text-white" : "bg-counter text-ink hover:bg-counter-deep",
    )

  const filterContent = (idPrefix: string) => (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-1">
        <h2 className="mb-1.5 text-[17px] font-extrabold">Category</h2>
        {sidebarCategories.map((cat) => (
          <label key={cat.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={selectedCategories.includes(cat.slug.toLowerCase())}
              onChange={() => toggleCategory(cat.slug.toLowerCase())}
            />
            <span className={cn("flex-1", cat.parentId && "pl-3 text-mute")}>{cat.name}</span>
            <span className="text-mute tabular-nums">{cat.productCount}</span>
          </label>
        ))}
        {categories.length > CATEGORY_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAllCategories((v) => !v)}
            aria-expanded={showAllCategories}
            className="mt-1 min-h-11 self-start text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
          >
            {showAllCategories ? "Show fewer" : `Show all ${categories.length} categories`}
          </button>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-extrabold">Price (GH₵)</h2>
        <div className="flex gap-2.5">
          <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold text-mute">
            Min
            <input
              key={`${idPrefix}-min-${priceRange[0]}`}
              type="number"
              inputMode="numeric"
              min={MIN_PRICE}
              max={maxPrice}
              defaultValue={priceRange[0] > MIN_PRICE ? priceRange[0] : ""}
              placeholder={String(MIN_PRICE)}
              onBlur={(e) => setPriceBound(0, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setPriceBound(0, e.currentTarget.value)
              }}
              className="input-no-spinner h-11 rounded-[10px] border border-field bg-white px-3 text-[15px] font-normal text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold text-mute">
            Max
            <input
              key={`${idPrefix}-max-${priceRange[1]}`}
              type="number"
              inputMode="numeric"
              min={MIN_PRICE}
              max={maxPrice}
              defaultValue={priceRange[1] < maxPrice ? priceRange[1] : ""}
              placeholder={String(maxPrice)}
              onBlur={(e) => setPriceBound(1, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setPriceBound(1, e.currentTarget.value)
              }}
              className="input-no-spinner h-11 rounded-[10px] border border-field bg-white px-3 text-[15px] font-normal text-ink focus:border-ink focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="mb-1.5 text-[17px] font-extrabold">Show only</h2>
        <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked)
              setVisibleCount(ITEMS_PER_PAGE)
            }}
          />
          In stock
        </label>
        <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={saleOnly}
            onChange={(e) => setSaleOnly(e.target.checked)}
          />
          On sale
        </label>
      </section>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="min-h-11 rounded-xl border border-field text-[15px] font-bold text-ink hover:bg-counter"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  const removable = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-field bg-white px-3 text-sm font-semibold text-ink hover:border-ink"

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-16 sm:px-6 lg:px-10">
        <CampaignBanner compact className="mb-6" />

        <nav aria-label="Breadcrumb" className="text-sm text-mute">
          <Link href="/" className="text-mute hover:text-ink">
            Home
          </Link>{" "}
          / <span className="text-ink">Shop</span>
        </nav>

        <div className="mt-3.5 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[44px]">{title}</h1>
            <p className="mt-1.5 text-base text-mute">{subtitle}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border-2 border-brand px-4 text-[15px] font-bold lg:hidden"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <label htmlFor={sortId} className="ml-auto flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="hidden sm:inline">Sort by</span>
              <span className="sr-only sm:hidden">Sort by</span>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="min-h-[46px] rounded-xl border-2 border-brand bg-white px-3 text-[15px] font-semibold text-ink focus:outline-none"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <nav aria-label="Popular categories" className="-mx-4 mb-7 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button
            type="button"
            onClick={() => {
              setSelectedCategories([])
              setVisibleCount(ITEMS_PER_PAGE)
            }}
            aria-pressed={selectedCategories.length === 0}
            className={chip(selectedCategories.length === 0)}
          >
            All · {totalCount}
          </button>
          {topCategories.map((cat) => {
            const key = cat.slug.toLowerCase()
            const active = selectedCategories.length === 1 && selectedCategories[0] === key
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedCategories(active ? [] : [key])
                  setVisibleCount(ITEMS_PER_PAGE)
                }}
                className={chip(active)}
              >
                {cat.name} · {cat.productCount}
              </button>
            )
          })}
        </nav>

        {hasActiveFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {selectedCategories.map((slug) => {
              const cat = categories.find((c) => c.slug.toLowerCase() === slug)
              if (!cat) return null
              return (
                <button key={slug} type="button" onClick={() => toggleCategory(slug)} className={removable}>
                  {cat.name}
                  <X className="size-3.5" aria-hidden />
                  <span className="sr-only">Remove filter</span>
                </button>
              )
            })}
            {priceFiltered && (
              <button type="button" onClick={() => setPriceRange([MIN_PRICE, maxPrice])} className={removable}>
                {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            )}
            {inStockOnly && (
              <button type="button" onClick={() => setInStockOnly(false)} className={removable}>
                In stock
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            )}
            {saleOnly && (
              <button type="button" onClick={() => setSaleOnly(false)} className={removable}>
                On sale
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-9 px-1 text-sm font-bold text-raspberry underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex items-start gap-10">
          <aside aria-label="Filters" className="hidden w-[260px] shrink-0 lg:block">
            {filterContent("side")}
          </aside>

          <section aria-label="Products" className="min-w-0 flex-1">
            {displayedProducts.length > 0 ? (
              <>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
                  {displayedProducts.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} onQuickView={handleQuickView} />
                    </li>
                  ))}
                </ul>

                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-[15px] text-mute" aria-live="polite">
                    Showing {displayedProducts.length} of {filteredProducts.length} products
                  </p>
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                      className="min-h-[50px] rounded-xl bg-brand px-8 text-base font-bold text-white hover:bg-brand-deep"
                    >
                      Load {Math.min(ITEMS_PER_PAGE, filteredProducts.length - visibleCount)} more
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-[18px] bg-counter p-8 sm:p-10">
                <h2 className="text-[22px] font-extrabold">Nothing matches those filters</h2>
                <p className="max-w-md text-[15px] text-mute">
                  Try another category, widen the price range, or search for something else.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 min-h-12 rounded-xl bg-brand px-6 text-[15px] font-bold text-white"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="store w-[min(88vw,360px)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold">Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{filterContent("sheet")}</div>
          <div className="sticky bottom-0 mt-auto border-t border-line bg-white p-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="min-h-[52px] w-full rounded-xl bg-brand text-base font-bold text-white"
            >
              Show {filteredProducts.length} products
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <QuickViewModal
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        product={quickViewProduct}
      />
    </>
  )
}
