"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, MapPin, Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react"
import { cn, formatPrice, formatFreeShippingMinimumLabel } from "@/lib/utils"
import type { Product, ProductVariantRow } from "@/types/product"
import { ProductCard } from "@/components/shared/product-card"
import { QuickViewModal } from "@/components/shared/quick-view-modal"
import { BadgeSet } from "@/components/shared/badge-set"
import { Price, savePercent } from "@/components/shared/price"
import { useCartStore } from "@/lib/store/cart-store"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import {
  getProductGalleryImages,
  optimizedImageUrl,
} from "@/lib/product-image"
import { buildDisplaySku } from "@/lib/sku-display"
import { displayPricingForVariant } from "@/lib/effective-price"
import { findOption } from "@/lib/variant-options"
import { WHATSAPP_URL } from "@/lib/brand"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

/** Fallback swatch colours for shades saved without a hex value. */
const colorFallbacks: Record<string, string> = {
  Rosé: "#F08DAA",
  Ivory: "#FBF4DC",
  Black: "#1F2328",
  Noir: "#1F2328",
  Midnight: "#1E2245",
  Champagne: "#F3E2B8",
  Camel: "#D9A46A",
  Burgundy: "#7A1F2B",
  Blush: "#F5B8C8",
  Sage: "#8DC6A0",
  Cream: "#FBF1E2",
  Cognac: "#A85A24",
  Emerald: "#12A16F",
  Ruby: "#D8303A",
  Sapphire: "#2347A8",
  Tan: "#E3C48E",
  Charcoal: "#4A4F57",
  "Dusty Rose": "#E59AAE",
  Gold: "#E8BE45",
  Silver: "#C4C6CA",
  Nude: "#EDC9A6",
  Red: "#D8303A",
  Terracotta: "#E0714F",
  "Ballet Pink": "#F6BFD0",
  Espresso: "#4A2A12",
  Oatmeal: "#EEDCC4",
  Rose: "#EE8FA6",
  Garden: "#38B47A",
  Ocean: "#2FA6C8",
  Sunset: "#EE7046",
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

  const needsSize = product.variants.some((g) => g.type === "size")
  const needsColor = product.variants.some((g) => g.type === "color")
  if ((needsSize && !selectedSize) || (needsColor && !selectedColor)) return null

  return (
    rows.find((row) => {
      const size = findOption(row.option_values, "size")?.value ?? ""
      const color = findOption(row.option_values, "color")?.value ?? ""
      return (
        size === (needsSize ? selectedSize : "") &&
        color === (needsColor ? selectedColor : "")
      )
    }) ?? null
  )
}

function buildCartProductSnapshot(
  product: Product,
  row: ProductVariantRow | null,
): Product {
  if (!row) return product

  const { price, salePrice } = displayPricingForVariant(
    row,
    product.catalogSalePrice ?? null,
    {
      salesActive: product.salePromotionEnabled ?? false,
      discountPercent: product.discountPercent ?? 0,
      strictDiscount: product.strictDiscount ?? false,
      bestPrice: product.bestPrice ?? false,
    },
  )

  return {
    ...product,
    price,
    salePrice,
    regularPrice: row.price,
    variantSalePrice: row.sale_price,
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
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null,
  )
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)
  const hydrated = useHydrated()
  const storedInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))
  const inWishlist = hydrated && storedInWishlist

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

  // Build color name → hex map from stored variant option_values
  const colorHexMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of variantRows) {
      const color = findOption(row.option_values, "color")
      if (color?.hex && !map[color.value]) map[color.value] = color.hex
    }
    return map
  }, [variantRows])

  // Display only: an option is sold out when every stored variant row for it
  // (given the other option already picked) has no stock. Selection still works.
  const rowsHaveOptions = variantRows.some(
    (row) => (row.option_values?.length ?? 0) > 0,
  )
  function isOptionSoldOut(kind: "size" | "color", value: string): boolean {
    if (!rowsHaveOptions) return false
    const otherKind = kind === "size" ? "color" : "size"
    const otherSelected = kind === "size" ? selectedColor : selectedSize
    const otherApplies =
      !!otherSelected && product.variants.some((g) => g.type === otherKind)
    const matches = variantRows.filter((row) => {
      if ((findOption(row.option_values, kind)?.value ?? "") !== value) return false
      if (!otherApplies) return true
      return (findOption(row.option_values, otherKind)?.value ?? "") === otherSelected
    })
    return matches.length === 0 || matches.every((row) => row.stock_quantity <= 0)
  }

  const stockStatus =
    needsVariantSelection
      ? {
          label: "Choose your options to see if it's in stock",
          textColor: "text-mute",
          dotColor: "bg-field",
        }
      : effectiveStock === 0
        ? {
            label: "Sold out",
            textColor: "text-[#B42318]",
            dotColor: "bg-[#B42318]",
          }
        : effectiveStock <= 5
          ? {
              label: `Low stock, only ${effectiveStock} left`,
              textColor: "text-[#6B4A00]",
              dotColor: "bg-[#C98A00]",
            }
          : {
              label: "In stock and ready to send",
              textColor: "text-[#1E6B3A]",
              dotColor: "bg-[#1E6B3A]",
            }

  const canPurchase =
    !needsVariantSelection && effectiveStock > 0 && (product.salePrice ?? product.price) > 0

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
      { openCart: false },
    )
    router.push("/checkout")
  }

  function handleQuickView(p: Product) {
    setQuickViewProduct(p)
    setQuickViewOpen(true)
  }

  const priceSource = variantRow ? displayProduct : product
  const lineTotal =
    (priceSource.salePrice ?? priceSource.price) * quantityClamped
  const pct = savePercent(priceSource.price, priceSource.salePrice)

  const missingOption =
    sizeVariant && !selectedSize
      ? sizeVariant.name || "size"
      : colorVariant && !selectedColor
        ? colorVariant.name || "shade"
        : null

  const selectedParts = [
    colorVariant && selectedColor ? selectedColor : null,
    sizeVariant && selectedSize ? selectedSize : null,
  ].filter(Boolean)

  const activeImage =
    galleryImages[
      Math.min(selectedImage, Math.max(0, galleryImages.length - 1))
    ] ?? galleryImages[0]

  const sku = variantRow?.sku ?? product.sku
  const whatsappHref = `${WHATSAPP_URL}?text=${encodeURIComponent(
    `Hi Ronny, I have a question about ${product.name}`,
  )}`

  const addLabel = !canPurchase
    ? needsVariantSelection
      ? missingOption
        ? `Choose ${missingOption.toLowerCase()}`
        : "Choose options"
      : effectiveStock === 0
        ? "Sold out"
        : "Unavailable"
    : `Add to bag · ${formatPrice(lineTotal)}`

  return (
    <>
      <div className="bg-white text-ink">
        <div className="mx-auto max-w-[1440px] px-4 pt-5 pb-16 sm:px-6 lg:px-10">
          <nav aria-label="Breadcrumb" className="text-sm text-mute">
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <li>
                <Link href="/" className="text-mute hover:text-ink">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/shop" className="text-mute hover:text-ink">
                  Shop
                </Link>
              </li>
              {product.categorySlug && (
                <>
                  <li aria-hidden>/</li>
                  <li>
                    <Link
                      href={`/shop?category=${product.categorySlug}`}
                      className="text-mute hover:text-ink"
                    >
                      {product.categoryName}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden>/</li>
              <li className="min-w-0 truncate text-ink" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>

          <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
            <section aria-label="Photos" className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-24">
              <div className="relative aspect-square overflow-hidden rounded-[18px] bg-counter">
                <img
                  src={optimizedImageUrl(activeImage, 1200)}
                  alt={product.name}
                  className="size-full object-cover"
                  decoding="async"
                />
                {product.badges.length > 0 && (
                  <div className="absolute top-3 left-3 z-10">
                    <BadgeSet
                      badges={
                        pct !== undefined
                          ? product.badges.filter((b) => b !== "Sale")
                          : product.badges
                      }
                    />
                  </div>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {galleryImages.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => setSelectedImage(i)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-pressed={selectedImage === i}
                      className={cn(
                        "size-20 shrink-0 overflow-hidden rounded-xl bg-counter transition-colors sm:size-24",
                        selectedImage === i
                          ? "border-2 border-brand"
                          : "border border-line hover:border-field",
                      )}
                    >
                      <img
                        src={optimizedImageUrl(src, 200)}
                        alt=""
                        className="size-full object-cover"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section
              aria-label="Product details"
              className="flex min-w-0 max-w-[560px] flex-col gap-6"
            >
              <div className="flex flex-col gap-2.5">
                {product.categorySlug && product.categoryName && (
                  <Link
                    href={`/shop?category=${product.categorySlug}`}
                    className="self-start text-sm font-bold text-mute hover:text-ink"
                  >
                    {product.categoryName}
                  </Link>
                )}
                <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] text-ink sm:text-[44px]">
                  {product.name}
                </h1>

                {product.reviewCount > 0 && product.rating > 0 && (
                  <p className="flex items-center gap-1.5 text-[15px] text-mute">
                    <Star className="size-4 fill-ink text-ink" aria-hidden />
                    <span className="font-semibold text-ink">
                      {product.rating.toFixed(1)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {product.reviewCount}{" "}
                      {product.reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Price
                    amount={priceSource.price}
                    salePrice={priceSource.salePrice}
                    size="lg"
                  />
                  {pct !== undefined && (
                    <span className="rounded-lg bg-blush px-2.5 py-1 text-sm font-bold text-raspberry">
                      Save {pct}%
                    </span>
                  )}
                </div>

                {product.shortDescription && (
                  <p className="text-[17px] leading-[1.55] text-[#3A3F4B]">
                    {product.shortDescription}
                  </p>
                )}
              </div>

              {(colorVariant || sizeVariant) && (
                <div className="flex flex-col gap-5">
                  {colorVariant && (
                    <fieldset className="m-0 border-0 p-0">
                      <legend className="mb-3 p-0 text-base font-bold text-ink">
                        {colorVariant.name || "Shade"}:{" "}
                        <span className="font-medium">
                          {selectedColor
                            ? `${selectedColor}${isOptionSoldOut("color", selectedColor) ? " (sold out)" : ""}`
                            : "pick one"}
                        </span>
                      </legend>
                      <div className="flex flex-wrap gap-2.5">
                        {colorVariant.options.map((color) => {
                          const hex = colorHexMap[color] ?? colorFallbacks[color] ?? "#C9C5BE"
                          const soldOut = isOptionSoldOut("color", color)
                          const selected = selectedColor === color
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setSelectedColor(color)}
                              aria-label={soldOut ? `${color}, sold out` : color}
                              aria-pressed={selected}
                              title={color}
                              className={cn(
                                "relative size-12 rounded-full bg-white p-1 transition-colors",
                                selected
                                  ? "border-2 border-brand"
                                  : "border border-[#DAD6D0] hover:border-field",
                                soldOut && "opacity-55",
                              )}
                            >
                              <span
                                className="block size-full rounded-full border border-black/10"
                                style={{ backgroundColor: hex }}
                              />
                              {soldOut && (
                                <span
                                  aria-hidden
                                  className="absolute top-1/2 right-1.5 left-1.5 h-0.5 -translate-y-1/2 -rotate-45 bg-brand"
                                />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  {sizeVariant && (
                    <fieldset className="m-0 border-0 p-0">
                      <legend className="mb-3 p-0 text-base font-bold text-ink">
                        {sizeVariant.name || "Size"}:{" "}
                        <span className="font-medium">
                          {selectedSize || "pick one"}
                        </span>
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {sizeVariant.options.map((opt) => {
                          const soldOut = isOptionSoldOut("size", opt)
                          const selected = selectedSize === opt
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setSelectedSize(opt)}
                              aria-label={soldOut ? `${opt}, sold out` : opt}
                              aria-pressed={selected}
                              className={cn(
                                "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold transition-colors",
                                selected
                                  ? "border-2 border-brand bg-brand text-white"
                                  : "border border-field bg-white text-ink hover:border-ink",
                                soldOut && !selected && "text-mute line-through",
                                soldOut && selected && "line-through",
                              )}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  {selectedParts.length > 0 && (
                    <p className="text-[15px] text-ink">
                      <span className="font-bold">Selected:</span>{" "}
                      {selectedParts.join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <p
                className={cn(
                  "flex items-center gap-2 text-[15px] font-semibold",
                  stockStatus.textColor,
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-2.5 shrink-0 rounded-full", stockStatus.dotColor)}
                />
                {stockStatus.label}
              </p>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <div className="flex h-[54px] items-center rounded-xl border-2 border-brand">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantityClamped <= 1}
                      className="flex h-full w-12 items-center justify-center text-ink disabled:text-field"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-5" aria-hidden />
                    </button>
                    <span
                      aria-live="polite"
                      aria-label={`Quantity ${quantityClamped}`}
                      className="min-w-8 text-center text-[17px] font-bold tabular-nums"
                    >
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
                      className="flex h-full w-12 items-center justify-center text-ink disabled:text-field"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-5" aria-hidden />
                    </button>
                  </div>

                  {(product.salePrice ?? product.price) > 0 && (
                    <button
                      type="button"
                      onClick={handleAddToBag}
                      disabled={!canPurchase}
                      className="inline-flex min-h-[54px] flex-[1_1_220px] items-center justify-center rounded-xl bg-brand px-5 text-[17px] font-bold text-white tabular-nums transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-counter disabled:text-[#6B7080]"
                    >
                      {addLabel}
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  {(product.salePrice ?? product.price) > 0 && (
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={!canPurchase}
                      className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-brand bg-white px-5 text-base font-bold text-ink transition-colors hover:bg-counter disabled:cursor-not-allowed disabled:border-line disabled:text-[#6B7080] disabled:hover:bg-white"
                    >
                      Buy now
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    aria-pressed={inWishlist}
                    aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
                    className={cn(
                      "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-field bg-white px-4 text-base font-bold transition-colors hover:border-ink",
                      inWishlist ? "text-raspberry" : "text-ink",
                      (product.salePrice ?? product.price) > 0 ? "w-[52px] px-0" : "flex-1",
                    )}
                  >
                    <Heart
                      className="size-5"
                      fill={inWishlist ? "currentColor" : "none"}
                      aria-hidden
                    />
                    {!((product.salePrice ?? product.price) > 0) && (
                      <span>{inWishlist ? "Saved" : "Save for later"}</span>
                    )}
                  </button>
                </div>
              </div>

              <ul className="m-0 list-none rounded-2xl bg-counter p-0">
                <li className="flex gap-3.5 border-b border-line px-[18px] py-4">
                  <Truck className="mt-0.5 size-[22px] shrink-0 text-raspberry" aria-hidden />
                  <span className="text-[15px] leading-[1.45]">
                    <strong className="font-bold">Doorstep delivery across Accra and beyond.</strong>{" "}
                    {product.deliveryEstimate && <>Usually {product.deliveryEstimate}. </>}
                    Free on orders over {formatFreeShippingMinimumLabel()}.
                  </span>
                </li>
                <li className="flex gap-3.5 border-b border-line px-[18px] py-4">
                  <MapPin className="mt-0.5 size-[22px] shrink-0 text-raspberry" aria-hidden />
                  <span className="text-[15px] leading-[1.45]">
                    <strong className="font-bold">Pickup</strong> at Manet Ville
                    Estates, East Airport Spintex, Accra.
                  </span>
                </li>
                <li className="flex gap-3.5 px-[18px] py-4">
                  <ShieldCheck className="mt-0.5 size-[22px] shrink-0 text-raspberry" aria-hidden />
                  <span className="text-[15px] leading-[1.45]">
                    <strong className="font-bold">Genuine products.</strong> Pay
                    safely with Mobile Money.
                  </span>
                </li>
              </ul>

              <p className="text-[15px] text-ink">
                Questions about this one?{" "}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-raspberry underline-offset-2 hover:text-raspberry-deep hover:underline"
                >
                  Ask Ronny on WhatsApp
                </a>
              </p>

              <div className="border-t border-line">
                <Accordion defaultValue={["description"]}>
                  <AccordionItem value="description" className="border-b border-line">
                    <AccordionTrigger className="min-h-14 items-center py-4 text-[17px] font-bold text-ink hover:no-underline">
                      Description
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-base leading-[1.6] text-[#3A3F4B]">
                      {product.description && (
                        <p className="whitespace-pre-line">{product.description}</p>
                      )}
                      <p
                        className="text-sm text-mute"
                        title={sku ? `Stored SKU: ${sku}` : undefined}
                      >
                        SKU: {buildDisplaySku(product.name, sku ?? "")}
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="delivery" className="border-b border-line">
                    <AccordionTrigger className="min-h-14 items-center py-4 text-[17px] font-bold text-ink hover:no-underline">
                      Delivery and returns
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-base leading-[1.6] text-[#3A3F4B]">
                      <p>
                        Choose doorstep delivery or pickup at Spintex when you
                        check out. Delivery is free on orders over{" "}
                        {formatFreeShippingMinimumLabel()}.
                      </p>
                      <p>
                        <Link href="/policies/shipping" className="font-semibold text-raspberry">
                          Delivery details
                        </Link>
                        {" · "}
                        <Link href="/policies/returns" className="font-semibold text-raspberry">
                          Returns policy
                        </Link>
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  {sizeVariant && (
                    <AccordionItem value="size-guide" className="border-b border-line">
                      <AccordionTrigger className="min-h-14 items-center py-4 text-[17px] font-bold text-ink hover:no-underline">
                        Size guide
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-base leading-[1.6] text-[#3A3F4B]">
                        <p>
                          Not sure which size to pick?{" "}
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-raspberry"
                          >
                            Ask us on WhatsApp
                          </a>{" "}
                          and we&apos;ll help you choose.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            </section>
          </div>

          {relatedProducts.length > 0 && (
            <section aria-labelledby="pairs-well-with" className="mt-16 flex flex-col gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2
                  id="pairs-well-with"
                  className="text-[24px] font-extrabold tracking-[-0.02em] text-ink sm:text-[30px]"
                >
                  Pairs well with
                </h2>
                {product.categorySlug && product.categoryName && (
                  <Link
                    href={`/shop?category=${product.categorySlug}`}
                    className="text-[15px] font-bold text-raspberry hover:text-raspberry-deep"
                  >
                    More {product.categoryName}
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-5 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onQuickView={handleQuickView} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <QuickViewModal
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        product={quickViewProduct}
      />
    </>
  )
}
