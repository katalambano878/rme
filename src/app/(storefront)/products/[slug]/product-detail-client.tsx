"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  Star,
  Minus,
  Plus,
  Heart,
  X,
  Link2,
} from "lucide-react"

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.99 2.25h6.908l4.263 5.705L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function IconLinkedin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  )
}
import { cn, formatPrice, formatFreeShippingMinimumLabel } from "@/lib/utils"
import type { Product, ProductVariantRow } from "@/types/product"
import { Container } from "@/components/shared/container"
import { Heading } from "@/components/shared/heading"
import { ProductCard } from "@/components/shared/product-card"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { getProductGalleryImages } from "@/lib/product-image"
import { buildDisplaySku } from "@/lib/sku-display"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

const colorGradients: Record<string, string> = {
  Rosé: "from-pink-300 to-rose-400",
  Ivory: "from-amber-50 to-yellow-100",
  Black: "from-gray-800 to-gray-900",
  Noir: "from-gray-800 to-gray-900",
  Midnight: "from-indigo-900 to-slate-900",
  Champagne: "from-amber-100 to-yellow-200",
  Camel: "from-amber-300 to-orange-300",
  Burgundy: "from-red-800 to-red-900",
  Blush: "from-pink-200 to-rose-300",
  Sage: "from-green-300 to-emerald-300",
  Cream: "from-amber-50 to-orange-50",
  Cognac: "from-amber-600 to-orange-700",
  Emerald: "from-emerald-500 to-emerald-600",
  Ruby: "from-red-500 to-red-600",
  Sapphire: "from-blue-600 to-blue-800",
  Tan: "from-amber-200 to-amber-300",
  Charcoal: "from-gray-600 to-gray-700",
  "Dusty Rose": "from-pink-300 to-rose-400",
  Gold: "from-amber-300 to-yellow-400",
  Silver: "from-gray-300 to-gray-400",
  Nude: "from-orange-100 to-amber-200",
  Red: "from-red-500 to-red-600",
  Terracotta: "from-orange-400 to-red-400",
  "Ballet Pink": "from-pink-200 to-pink-300",
  Espresso: "from-amber-900 to-amber-950",
  Oatmeal: "from-amber-100 to-orange-100",
  Rose: "from-rose-300 to-pink-400",
  Garden: "from-green-400 to-emerald-500",
  Ocean: "from-blue-400 to-cyan-500",
  Sunset: "from-orange-400 to-red-400",
  Purple: "from-violet-400 to-purple-600",
  Coffee: "from-amber-800 to-amber-950",
  Wine: "from-red-800 to-rose-900",
}

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.08 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function findMatchingVariantRow(
  rows: ProductVariantRow[],
  product: Product,
  selectedSize: string,
  selectedColor: string,
): ProductVariantRow | null {
  if (rows.length === 0) return null
  if (rows.length === 1 && (rows[0].option_values?.length ?? 0) === 0) {
    return rows[0]
  }

  const selectedMap: Record<string, string> = {}
  for (const g of product.variants) {
    if (g.type === "size" && selectedSize) selectedMap[g.name] = selectedSize
    if (g.type === "color" && selectedColor) selectedMap[g.name] = selectedColor
  }

  for (const g of product.variants) {
    if (!selectedMap[g.name]) return null
  }

  return (
    rows.find((row) => {
      const opts = row.option_values ?? []
      if (opts.length !== product.variants.length) return false
      return opts.every((o) => {
        const key = (o as any).name || (o as any).attribute_name
        return selectedMap[key] === o.value
      })
    }) ?? null
  )
}

function buildCartProductSnapshot(
  product: Product,
  row: ProductVariantRow | null,
): Product {
  if (!row) return product

  if (row.sale_price != null && row.sale_price > 0 && row.sale_price < row.price) {
    return { ...product, price: row.price, salePrice: row.sale_price, sku: row.sku, stock: row.stock_quantity }
  }

  const variantCompareAtSale =
    row.compare_at_price != null &&
    !Number.isNaN(row.compare_at_price) &&
    row.compare_at_price > row.price
  if (variantCompareAtSale) {
    return {
      ...product,
      price: row.compare_at_price!,
      salePrice: row.price,
      sku: row.sku,
      stock: row.stock_quantity,
    }
  }

  const inheritProductSale =
    product.salePrice !== undefined && row.price === product.price
  return {
    ...product,
    price: row.price,
    salePrice: inheritProductSale ? product.salePrice : undefined,
    sku: row.sku,
    stock: row.stock_quantity,
  }
}

export type ProductDetailClientProps = {
  product: Product
  variantRows: ProductVariantRow[]
  relatedProducts: Product[]
}

export function ProductDetailClient(props: ProductDetailClientProps) {
  return <ProductDetailInner key={props.product.id} {...props} />
}

function ProductDetailInner({
  product,
  variantRows,
  relatedProducts,
}: ProductDetailClientProps) {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState("")
  const [selectedColor, setSelectedColor] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [pageUrl, setPageUrl] = useState("")
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)
  const inWishlist = useWishlistStore((s) => s.isInWishlist(product.id))

  useEffect(() => {
    setPageUrl(window.location.href)
  }, [])

  const variantRow = useMemo(
    () =>
      findMatchingVariantRow(
        variantRows,
        product,
        selectedSize,
        selectedColor,
      ),
    [variantRows, product, selectedSize, selectedColor],
  )

  const displayProduct = useMemo(
    () => buildCartProductSnapshot(product, variantRow),
    [product, variantRow],
  )

  const needsVariantSelection =
    product.variants.length > 0 && variantRow === null

  const effectiveStock = variantRow
    ? variantRow.stock_quantity
    : product.variants.length === 0
      ? product.stock
      : 0

  const galleryImages = useMemo(
    () => getProductGalleryImages(product),
    [product],
  )

  const quantityClamped = Math.min(
    Math.max(1, quantity),
    Math.max(1, effectiveStock || 1),
  )

  const sizeVariant = useMemo(
    () => product.variants.find((v) => v.type === "size"),
    [product.variants],
  )
  const colorVariant = useMemo(
    () => product.variants.find((v) => v.type === "color"),
    [product.variants],
  )

  const colorHexMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of variantRows) {
      for (const ov of row.option_values as any[]) {
        const fieldName: string = ov.name || ov.attribute_name || ""
        if (
          fieldName.toLowerCase().includes("color") ||
          fieldName.toLowerCase().includes("colour")
        ) {
          if (ov.hex && ov.value) map[ov.value] = ov.hex
        }
      }
    }
    return map
  }, [variantRows])

  const inStock = !needsVariantSelection && effectiveStock > 0
  const outOfStock = !needsVariantSelection && effectiveStock === 0
  const canPurchase = inStock

  const hasOptions = Boolean(sizeVariant || colorVariant)
  const hasSelection = Boolean(selectedSize || selectedColor || quantity > 1)

  function handleClear() {
    setSelectedSize("")
    setSelectedColor("")
    setQuantity(1)
  }

  function handleAddToBag() {
    if (!canPurchase) return
    addItem(
      buildCartProductSnapshot(product, variantRow),
      quantityClamped,
      selectedSize || undefined,
      selectedColor || undefined,
    )
  }

  function handleBuyNow() {
    if (!canPurchase) return
    addItem(
      buildCartProductSnapshot(product, variantRow),
      quantityClamped,
      selectedSize || undefined,
      selectedColor || undefined,
    )
    router.push("/checkout")
  }

  function goPrevImage() {
    if (galleryImages.length < 2) return
    setSelectedImage((i) => (i - 1 + galleryImages.length) % galleryImages.length)
  }

  function goNextImage() {
    if (galleryImages.length < 2) return
    setSelectedImage((i) => (i + 1) % galleryImages.length)
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    if (!url) return
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: product.name, url })
        return
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const priceSource = variantRow ? displayProduct : product
  const hasSale =
    priceSource.salePrice !== undefined &&
    priceSource.salePrice < priceSource.price
  const displaySku = buildDisplaySku(
    product.name,
    variantRow?.sku ?? product.sku ?? "",
  )
  const tagList = [
    product.categoryName,
    ...product.badges.map(String),
  ].filter(Boolean)

  const shareUrl = encodeURIComponent(pageUrl)
  const shareTitle = encodeURIComponent(product.name)

  const safeImageIndex = Math.min(
    selectedImage,
    Math.max(0, galleryImages.length - 1),
  )

  return (
    <>
      <div className="min-h-screen bg-white">
        <Container className="py-8 sm:py-12">
          <nav className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-navy">
              Home
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/shop" className="transition-colors hover:text-navy">
              Shop
            </Link>
            {product.categorySlug && (
              <>
                <ChevronRight className="size-3.5" />
                <Link
                  href={`/shop?category=${product.categorySlug}`}
                  className="transition-colors hover:text-navy"
                >
                  {product.categoryName}
                </Link>
              </>
            )}
            <ChevronRight className="size-3.5" />
            <span className="truncate font-medium text-navy">
              {product.name}
            </span>
          </nav>

          <motion.div
            className="grid gap-10 lg:grid-cols-2 lg:gap-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            {/* Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-md bg-[#f5f5f5]">
                <img
                  src={galleryImages[safeImageIndex] ?? galleryImages[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />

                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrevImage}
                      className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center bg-rose-primary text-navy shadow-sm transition hover:brightness-95"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNextImage}
                      className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center bg-white text-navy shadow-sm transition hover:bg-rose-light"
                      aria-label="Next image"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="flex flex-wrap gap-3">
                  {galleryImages.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => setSelectedImage(i)}
                      className={cn(
                        "relative aspect-square w-[72px] overflow-hidden rounded-sm border bg-[#f5f5f5] transition sm:w-20",
                        selectedImage === i
                          ? "border-navy"
                          : "border-transparent opacity-80 hover:opacity-100",
                      )}
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <motion.div
              className="flex flex-col lg:sticky lg:top-24 lg:self-start"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              {product.categoryName && (
                <p className="text-sm text-muted-foreground">
                  {product.categoryName}
                </p>
              )}

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy md:text-[2rem] md:leading-tight">
                {product.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-4",
                        i < Math.round(product.rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted",
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating.toFixed(1)} ({product.reviewCount} Review
                  {product.reviewCount === 1 ? "" : "s"})
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-navy md:text-3xl">
                  {formatPrice(
                    hasSale ? priceSource.salePrice! : priceSource.price,
                  )}
                </span>
                {hasSale && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(priceSource.price)}
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {product.shortDescription || product.description}
              </p>

              <div className="mt-7 space-y-6">
                {colorVariant && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-navy">
                      Color
                      {selectedColor ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          : {selectedColor}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {colorVariant.options.map((color) => {
                        const hex = colorHexMap[color]
                        const selected = selectedColor === color
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            style={hex ? { backgroundColor: hex } : undefined}
                            className={cn(
                              "size-8 rounded-full border border-black/10 transition",
                              !hex &&
                                (colorGradients[color]
                                  ? `bg-gradient-to-br ${colorGradients[color]}`
                                  : "bg-gray-300"),
                              selected
                                ? "ring-2 ring-navy ring-offset-2"
                                : "hover:scale-105",
                            )}
                            aria-label={color}
                            aria-pressed={selected}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {sizeVariant && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-navy">
                      Size
                      {selectedSize ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          : {selectedSize}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sizeVariant.options.map((opt) => {
                        const selected = selectedSize === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelectedSize(opt)}
                            className={cn(
                              "min-w-12 border px-3.5 py-2 text-sm font-medium transition",
                              selected
                                ? "border-rose-primary bg-rose-primary text-navy"
                                : "border-slate-200 bg-white text-navy hover:border-navy/40",
                            )}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSizeGuideOpen((o) => !o)}
                      className="mt-3 text-sm text-navy underline underline-offset-4 transition hover:text-rose-primary"
                    >
                      View Size Guide
                    </button>
                    {sizeGuideOpen && (
                      <div className="mt-3 space-y-2 border border-slate-200 bg-[#fafafa] p-4 text-sm text-muted-foreground">
                        <p>
                          Our pieces are designed with a true-to-size fit. If
                          you&apos;re between sizes, we recommend sizing up for a
                          more relaxed feel.
                        </p>
                        <p>
                          For detailed measurements and fitting advice, please
                          reach out to our styling team.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clear + stock + actions */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {hasOptions && hasSelection && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-navy"
                  >
                    <X className="size-3.5" />
                    Clear
                  </button>
                )}

                <span
                  className={cn(
                    "inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold",
                    inStock &&
                      "border-emerald-300 bg-emerald-50 text-emerald-700",
                    outOfStock && "border-red-300 bg-red-50 text-red-700",
                    needsVariantSelection &&
                      "border-slate-200 bg-slate-50 text-muted-foreground",
                  )}
                >
                  {needsVariantSelection
                    ? "Select options"
                    : outOfStock
                      ? "Out of Stock"
                      : effectiveStock <= 5
                        ? `Low Stock (${effectiveStock})`
                        : "In Stock"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
                <div className="flex items-center border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex size-11 items-center justify-center text-navy transition hover:bg-rose-light"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-navy">
                    {quantityClamped}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(Math.max(1, effectiveStock), q + 1),
                      )
                    }
                    disabled={effectiveStock <= 0}
                    className="flex size-11 items-center justify-center text-navy transition hover:bg-rose-light disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToBag}
                  disabled={!canPurchase}
                  className="min-w-[140px] flex-1 bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!canPurchase
                    ? needsVariantSelection
                      ? "Select options"
                      : "Unavailable"
                    : "Add to Cart"}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!canPurchase}
                  className="min-w-[120px] flex-1 bg-rose-primary px-5 py-3 text-sm font-semibold text-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Buy Now
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center border border-slate-200 transition hover:border-navy/30",
                    inWishlist && "border-rose-primary text-rose-primary",
                  )}
                  aria-label={
                    inWishlist ? "Remove from wishlist" : "Add to wishlist"
                  }
                >
                  <Heart
                    className="size-5"
                    fill={inWishlist ? "currentColor" : "none"}
                  />
                </button>
              </div>

              {/* SKU / Tags / Share */}
              <div className="mt-8 space-y-3 border-t border-slate-100 pt-6 text-sm">
                <p className="text-navy">
                  <span className="font-semibold">SKU</span>
                  <span className="mx-2 text-muted-foreground">:</span>
                  <span
                    className="text-muted-foreground"
                    title={
                      variantRow?.sku ?? product.sku
                        ? `Stored SKU: ${variantRow?.sku ?? product.sku}`
                        : undefined
                    }
                  >
                    {displaySku}
                  </span>
                </p>

                {tagList.length > 0 && (
                  <p className="text-navy">
                    <span className="font-semibold">Tags</span>
                    <span className="mx-2 text-muted-foreground">:</span>
                    <span className="text-muted-foreground">
                      {tagList.join(", ")}
                    </span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-navy">
                  <span className="font-semibold">Share</span>
                  <span className="text-muted-foreground">:</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={
                        pageUrl
                          ? `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`
                          : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center text-muted-foreground transition hover:text-navy"
                      aria-label="Share on Facebook"
                      onClick={(e) => {
                        if (!pageUrl) e.preventDefault()
                      }}
                    >
                      <IconFacebook className="size-4" />
                    </a>
                    <a
                      href={
                        pageUrl
                          ? `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`
                          : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center text-muted-foreground transition hover:text-navy"
                      aria-label="Share on X"
                      onClick={(e) => {
                        if (!pageUrl) e.preventDefault()
                      }}
                    >
                      <IconX className="size-4" />
                    </a>
                    <a
                      href={
                        pageUrl
                          ? `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`
                          : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center text-muted-foreground transition hover:text-navy"
                      aria-label="Share on LinkedIn"
                      onClick={(e) => {
                        if (!pageUrl) e.preventDefault()
                      }}
                    >
                      <IconLinkedin className="size-4" />
                    </a>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex size-8 items-center justify-center text-muted-foreground transition hover:text-navy"
                      aria-label="Copy product link"
                      title={shareCopied ? "Copied!" : "Copy link"}
                    >
                      <Link2 className="size-4" />
                    </button>
                    {shareCopied && (
                      <span className="text-xs text-emerald-600">Copied</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Accordion>
                  {product.description &&
                    product.description !== product.shortDescription && (
                      <AccordionItem>
                        <AccordionTrigger className="text-sm font-semibold text-navy">
                          Full Description
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  <AccordionItem>
                    <AccordionTrigger className="text-sm font-semibold text-navy">
                      Shipping &amp; Returns
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-muted-foreground">
                        <p>
                          Complimentary standard shipping on orders over{" "}
                          {formatFreeShippingMinimumLabel()}. Orders are
                          processed within 1–2 business days.
                          {product.deliveryEstimate
                            ? ` Estimated delivery: ${product.deliveryEstimate}.`
                            : ""}
                        </p>
                        <p>
                          Items must be unused, in original packaging, and
                          accompanied by a receipt. Contact us to initiate a
                          return.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </motion.div>
          </motion.div>
        </Container>

        {relatedProducts.length > 0 && (
          <div className="border-t border-slate-100 bg-[#fafafa]">
            <Container className="py-16 sm:py-20">
              <Heading
                as="h2"
                align="center"
                subtitle="Pieces we think you'll adore"
              >
                You May Also Like
              </Heading>

              <motion.div
                className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={staggerContainer}
              >
                {relatedProducts.map((p) => (
                  <motion.div key={p.id} variants={staggerItem}>
                    <ProductCard product={p} />
                  </motion.div>
                ))}
              </motion.div>
            </Container>
          </div>
        )}
      </div>
    </>
  )
}
