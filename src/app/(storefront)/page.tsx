import type { Metadata } from "next"
import { BRAND_NAME, BRAND_LEGAL_NAME, BRAND_TAGLINE, SITE_DOMAIN } from "@/lib/brand"
import { HeroSection } from "@/components/home/hero-section"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Online Store`,
  description: `Shop ${BRAND_LEGAL_NAME} — quality products, secure checkout, and reliable delivery. ${BRAND_TAGLINE}`,
  keywords: [
    `${BRAND_NAME} online store`,
    "ecommerce",
    "online shopping",
    "shop online",
    "Trust Ecom",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: `${BRAND_NAME} — Online Store`,
    description: `Shop ${BRAND_LEGAL_NAME} — quality products and secure checkout. ${BRAND_TAGLINE}`,
    url: siteUrl,
    type: "website",
    images: [{ url: "/opengraph-image.png", alt: `${BRAND_NAME} homepage` }],
  },
}
import { CategoriesRow } from "@/components/home/categories-row"
import { FeaturedCollections } from "@/components/home/featured-collections"
import { TrendingCarousel } from "@/components/home/trending-carousel"
import { PromoBannersSection } from "@/components/home/promo-banners-section"
import { NewsletterSection } from "@/components/home/newsletter-section"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import {
  fetchNewArrivals,
  fetchBestSellers,
  fetchTrendingProducts,
  fetchHomepageCategoryLimit,
  fetchStorefrontCategoriesWithCounts,
} from "@/lib/data/storefront-products"

const HOME_PRODUCT_LIMIT = 8

export default async function HomePage() {
  const [newArrivals, curatedPicks, featuredProducts, allCategories, homeCategoryLimit] =
    await Promise.all([
      fetchNewArrivals(HOME_PRODUCT_LIMIT),
      fetchBestSellers(HOME_PRODUCT_LIMIT),
      fetchTrendingProducts(HOME_PRODUCT_LIMIT),
      fetchStorefrontCategoriesWithCounts(),
      fetchHomepageCategoryLimit(),
    ])
  const categories =
    homeCategoryLimit && homeCategoryLimit > 0
      ? allCategories.slice(0, homeCategoryLimit)
      : allCategories.slice(0, 4)

  return (
    <>
      <HeroSection />

      <CategoriesRow categories={categories} />

      <Section className="bg-rose-light pt-8 sm:pt-12">
        <Container>
          <FeaturedCollections
            newArrivals={newArrivals}
            curatedPicks={curatedPicks}
            limit={HOME_PRODUCT_LIMIT}
          />
        </Container>
      </Section>

      {featuredProducts.length > 0 && (
        <TrendingCarousel
          products={featuredProducts}
          limit={HOME_PRODUCT_LIMIT}
          className="pt-0 sm:pt-4"
        />
      )}

      <PromoBannersSection />

      <NewsletterSection />
    </>
  )
}
