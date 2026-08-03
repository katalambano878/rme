"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { SlidersHorizontal, X, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import type { Product } from "@/types/product"
import type { StorefrontCategory } from "@/lib/data/storefront-products"
import { Container } from "@/components/shared/container"
import { ProductCard } from "@/components/shared/product-card"
import { PageHero } from "@/components/shared/page-hero"
import { HERO_IMAGES } from "@/lib/hero-images"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const ITEMS_PER_PAGE = 12

const sortOptions = [
  { value: "default", label: "Default Sorting" },
  { value: "best-sellers", label: "Best Sellers" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "top-rated", label: "Top Rated" },
] as const

const MIN_PRICE = 0

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    initialCategory ? [initialCategory] : [],
  )
  const [priceRange, setPriceRange] = useState<number[]>([MIN_PRICE, maxPrice])
  const [sort, setSort] = useState<string>("default")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [newArrivalsOnly, setNewArrivalsOnly] = useState(false)
  const [bestSellersOnly, setBestSellersOnly] = useState(false)
  const [onSaleOnly, setOnSaleOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    setPriceRange([MIN_PRICE, maxPrice])
  }, [maxPrice])

  useEffect(() => {
    const cat = searchParams.get("category")
    if (cat) setSelectedCategories([cat.toLowerCase()])
    const filter = searchParams.get("filter")
    if (filter === "best-sellers") {
      setBestSellersOnly(true)
      setSort("best-sellers")
    }
    if (filter === "sale") setOnSaleOnly(true)
    if (filter === "new") setNewArrivalsOnly(true)
  }, [searchParams])

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

    if (inStockOnly) result = result.filter((p) => p.stock > 0)
    if (newArrivalsOnly) result = result.filter((p) => p.isNewArrival)
    if (bestSellersOnly) result = result.filter((p) => p.isBestSeller)
    if (onSaleOnly) {
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
      default:
        break
    }

    return result
  }, [
    products,
    selectedCategories,
    priceRange,
    sort,
    inStockOnly,
    newArrivalsOnly,
    bestSellersOnly,
    onSaleOnly,
  ])

  const displayedProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length
  const showingFrom = filteredProducts.length === 0 ? 0 : 1
  const showingTo = displayedProducts.length

  const priceFilterActive =
    priceRange[0] > MIN_PRICE || priceRange[1] < maxPrice

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    priceFilterActive ||
    inStockOnly ||
    newArrivalsOnly ||
    bestSellersOnly ||
    onSaleOnly

  const activeFilterCount =
    selectedCategories.length +
    (priceFilterActive ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (newArrivalsOnly ? 1 : 0) +
    (bestSellersOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0)

  function toggleCategory(slug: string) {
    const key = slug.toLowerCase()
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    )
    setVisibleCount(ITEMS_PER_PAGE)
  }

  function clearFilters() {
    setSelectedCategories([])
    setPriceRange([MIN_PRICE, maxPrice])
    setInStockOnly(false)
    setNewArrivalsOnly(false)
    setBestSellersOnly(false)
    setOnSaleOnly(false)
    setSort("default")
    setVisibleCount(ITEMS_PER_PAGE)
  }

  const FilterPill = ({
    label,
    onRemove,
  }: {
    label: string
    onRemove: () => void
  }) => (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90"
    >
      {label}
      <X className="size-3 opacity-80" />
    </button>
  )

  const filterContent = (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-navy">By Categories</h3>
        <div className="mt-4 space-y-3">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className="flex cursor-pointer items-center gap-2.5"
            >
              <Checkbox
                checked={selectedCategories.includes(cat.slug.toLowerCase())}
                onCheckedChange={() => toggleCategory(cat.slug.toLowerCase())}
              />
              <span className="text-sm text-muted-foreground whitespace-pre-wrap">
                {cat.displayName}
              </span>
              <span className="ml-auto text-xs text-muted-foreground/80">
                ({cat.productCount})
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-navy">Price</h3>
        <div className="mt-4 px-1">
          <Slider
            value={priceRange}
            onValueChange={(val) => {
              setPriceRange(val as number[])
              setVisibleCount(ITEMS_PER_PAGE)
            }}
            min={MIN_PRICE}
            max={maxPrice}
            step={10}
          />
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatPrice(priceRange[0])}</span>
            <span>{formatPrice(priceRange[1])}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-navy">By Promotions</h3>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={newArrivalsOnly}
              onCheckedChange={(checked) => {
                setNewArrivalsOnly(Boolean(checked))
                setVisibleCount(ITEMS_PER_PAGE)
              }}
            />
            <span className="text-sm text-muted-foreground">New Arrivals</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={bestSellersOnly}
              onCheckedChange={(checked) => {
                setBestSellersOnly(Boolean(checked))
                setVisibleCount(ITEMS_PER_PAGE)
              }}
            />
            <span className="text-sm text-muted-foreground">Best Sellers</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={onSaleOnly}
              onCheckedChange={(checked) => {
                setOnSaleOnly(Boolean(checked))
                setVisibleCount(ITEMS_PER_PAGE)
              }}
            />
            <span className="text-sm text-muted-foreground">On Sale</span>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-navy">Availability</h3>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={inStockOnly}
              onCheckedChange={(checked) => {
                setInStockOnly(Boolean(checked))
                setVisibleCount(ITEMS_PER_PAGE)
              }}
            />
            <span className="text-sm text-muted-foreground">In Stock</span>
          </label>
        </div>
      </div>
    </div>
  )

  const resultsToolbar = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-navy">
          {showingFrom}-{showingTo}
        </span>{" "}
        of{" "}
        <span className="font-medium text-navy">{filteredProducts.length}</span>{" "}
        results
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by :</span>
        <Select
          value={sort}
          onValueChange={(val) => {
            if (val) {
              setSort(val)
              setVisibleCount(ITEMS_PER_PAGE)
            }
          }}
        >
          <SelectTrigger className="h-9 w-[180px] rounded-lg border-slate-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const activeFiltersRow = hasActiveFilters ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-navy">Active Filter</span>
      {selectedCategories.map((slug) => {
        const cat = categories.find((c) => c.slug.toLowerCase() === slug)
        if (!cat) return null
        return (
          <FilterPill
            key={slug}
            label={cat.name}
            onRemove={() => toggleCategory(slug)}
          />
        )
      })}
      {priceFilterActive ? (
        <FilterPill
          label={`Price: ${formatPrice(priceRange[0])} - ${formatPrice(priceRange[1])}`}
          onRemove={() => setPriceRange([MIN_PRICE, maxPrice])}
        />
      ) : null}
      {newArrivalsOnly ? (
        <FilterPill
          label="New Arrivals"
          onRemove={() => setNewArrivalsOnly(false)}
        />
      ) : null}
      {bestSellersOnly ? (
        <FilterPill
          label="Best Seller"
          onRemove={() => setBestSellersOnly(false)}
        />
      ) : null}
      {onSaleOnly ? (
        <FilterPill label="On Sale" onRemove={() => setOnSaleOnly(false)} />
      ) : null}
      {inStockOnly ? (
        <FilterPill label="In Stock" onRemove={() => setInStockOnly(false)} />
      ) : null}
      <button
        type="button"
        onClick={clearFilters}
        className="text-sm font-medium text-rose-primary transition-colors hover:text-rose-primary/80"
      >
        Clear All
      </button>
    </div>
  ) : null

  return (
    <>
      <PageHero
        imageSrc={HERO_IMAGES.purse.src}
        imageAlt={HERO_IMAGES.purse.alt}
        title="Shop"
        subtitle="Browse our curated collection of bags, heels, and everyday essentials."
      />

      <div className="min-h-screen bg-white">
        <Container className="py-10 sm:py-14">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger
                render={<Button variant="outline" className="gap-2 rounded-xl" />}
              >
                <SlidersHorizontal className="size-4" />
                Filter Options
                {hasActiveFilters ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Options</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-8">{filterContent}</div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex gap-8 lg:gap-12">
            <aside className="hidden w-[260px] shrink-0 lg:block xl:w-[280px]">
              <div className="sticky top-24">
                <h2 className="mb-6 text-lg font-semibold text-navy">
                  Filter Options
                </h2>
                {filterContent}
              </div>
            </aside>

            <div className="min-w-0 flex-1 space-y-5">
              {resultsToolbar}
              {activeFiltersRow}

              {displayedProducts.length > 0 ? (
                <>
                  <motion.div
                    className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3"
                    initial="hidden"
                    animate="visible"
                    variants={staggerContainer}
                    key={`${selectedCategories.join(",")}-${sort}-${priceRange.join(",")}-${inStockOnly}-${newArrivalsOnly}-${bestSellersOnly}-${onSaleOnly}`}
                  >
                    {displayedProducts.map((product) => (
                      <motion.div key={product.id} variants={staggerItem}>
                        <ProductCard
                          product={product}
                          variant="catalog"
                        />
                      </motion.div>
                    ))}
                  </motion.div>

                  {hasMore ? (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
                        }
                        className="rounded-full border-slate-200 px-8 py-2.5 font-medium text-navy hover:border-navy hover:bg-navy hover:text-white"
                      >
                        Load More Products
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <motion.div
                  className="flex flex-col items-center justify-center py-24 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex size-20 items-center justify-center rounded-full bg-rose-light">
                    <Package className="size-8 text-rose-primary/60" />
                  </div>
                  <h3 className="mt-6 font-heading text-xl font-semibold text-navy">
                    No products found
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    We couldn&apos;t find anything matching your filters. Try
                    adjusting your criteria.
                  </p>
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mt-6 rounded-full px-6"
                  >
                    Clear All Filters
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </Container>
      </div>

    </>
  )
}
