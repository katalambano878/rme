import { cache } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  fetchStorefrontProductBySlug,
  fetchRelatedProducts,
} from "@/lib/supabase/storefront-products"
import { ProductDetailClient } from "./product-detail-client"
import { BRAND_NAME, BRAND_LOGO_SRC, SITE_DOMAIN } from "@/lib/brand"

const getProductDetail = cache(async (slug: string) => {
  return fetchStorefrontProductBySlug(slug)
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const detail = await getProductDetail(slug)

  if (!detail) {
    return {
      title: "Product Not Found",
      description: `This product is no longer available at ${BRAND_NAME}.`,
    }
  }

  const { product } = detail
  const siteUrl = `https://${SITE_DOMAIN}`
  const productUrl = `${siteUrl}/products/${product.slug}`
  const primaryImage = product.images?.[0]
  const price = product.salePrice ?? product.price

  const title = product.seoTitle || product.name
  const description =
    product.seoDescription ||
    product.shortDescription ||
    product.description?.slice(0, 155) ||
    `Shop ${product.name} at ${BRAND_NAME} — ${product.categoryName} available online in Ghana.`

  return {
    title,
    description,
    keywords: [
      product.name,
      product.categoryName,
      `${product.name} Ghana`,
      `buy ${product.name}`,
      `${product.categoryName} Ghana`,
      BRAND_NAME,
      "online store",
    ],
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: product.seoTitle || `${product.name} | ${BRAND_NAME}`,
      description,
      url: productUrl,
      siteName: BRAND_NAME,
      type: "website",
      locale: "en_GH",
      images: primaryImage
        ? [
            {
              url: primaryImage,
              width: 800,
              height: 800,
              alt: product.name,
            },
          ]
          : [{ url: "/opengraph-image.png", alt: BRAND_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${BRAND_NAME}`,
      description,
      images: primaryImage ? [primaryImage] : ["/opengraph-image.png"],
    },
    other: {
      "product:price:amount": String(price),
      "product:price:currency": "GHS",
      "product:availability": product.stock > 0 ? "in stock" : "out of stock",
      "product:category": product.categoryName,
      "product:brand": BRAND_NAME,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const detail = await getProductDetail(slug)
  if (!detail) notFound()

  const related = await fetchRelatedProducts(
    detail.product.categoryId || null,
    detail.product.id,
    4,
  )

  const siteUrl = `https://${SITE_DOMAIN}`
  const { product } = detail
  const price = product.salePrice ?? product.price

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl}/products/${product.slug}#product`,
    name: product.name,
    description:
      product.description ||
      product.shortDescription ||
      `${product.name} — available at ${BRAND_NAME}`,
    sku: product.sku,
    image: product.images?.length ? product.images : [`${siteUrl}${BRAND_LOGO_SRC}`],
    url: `${siteUrl}/products/${product.slug}`,
    brand: {
      "@type": "Brand",
      name: BRAND_NAME,
    },
    category: product.categoryName,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: "GHS",
      price: price.toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: BRAND_NAME,
        url: siteUrl,
      },
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(product.rating > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating.toFixed(1),
        reviewCount: product.reviewCount || 1,
        bestRating: "5",
        worstRating: "1",
      },
    }),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.categoryName,
        item: `${siteUrl}/shop?category=${product.categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${siteUrl}/products/${product.slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetailClient
        product={detail.product}
        variantRows={detail.variantRows}
        relatedProducts={related}
      />
    </>
  )
}
