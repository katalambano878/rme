import type { Metadata } from "next"
import { BRAND_NAME, BRAND_LEGAL_NAME, BRAND_TAGLINE, SITE_DOMAIN } from "@/lib/brand"
import { HeroSection } from "@/components/home/hero-section"
import { CampaignBanner } from "@/components/campaign/campaign-banner"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: { absolute: `${BRAND_NAME} — Beauty & Skincare Essentials` },
  description: `Shop ${BRAND_LEGAL_NAME} — premium skincare, lip care, body care, makeup, hair products, and baby essentials in Ghana. Fast delivery across Accra and beyond. ${BRAND_TAGLINE}`,
  keywords: [
    `${BRAND_NAME} online store`,
    "buy beauty products Ghana",
    "skincare Ghana",
    "lip gloss Ghana",
    "body lotion Ghana",
    "makeup Ghana",
    "beauty store Accra",
    "online cosmetics Ghana",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: `${BRAND_NAME} — Beauty & Skincare Essentials`,
    description: `Shop ${BRAND_LEGAL_NAME} — premium beauty products delivered in Ghana. Skincare, lip care, makeup & more. ${BRAND_TAGLINE}`,
    url: siteUrl,
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: `${BRAND_NAME} homepage` }],
  },
}
import { CategoriesRow } from "@/components/home/categories-row"
import { FeaturedCollections } from "@/components/home/featured-collections"
import { TrendingCarousel } from "@/components/home/trending-carousel"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import {
  fetchNewArrivals,
  fetchBestSellers,
  fetchTrendingProducts,
  fetchHomepageCategoryLimit,
  fetchStorefrontCategoriesWithCounts,
} from "@/lib/supabase/storefront-products"

const HOME_CATEGORY_DEFAULT = 12

export default async function HomePage() {
  const [newArrivals, curatedPicks, featuredProducts, allCategories, homeCategoryLimit] =
    await Promise.all([
      fetchNewArrivals(4),
      fetchBestSellers(4),
      fetchTrendingProducts(6),
      fetchStorefrontCategoriesWithCounts(),
      fetchHomepageCategoryLimit(),
    ])
  // Empty categories stay off the home page; they come back once stocked.
  const stocked = allCategories.filter((category) => category.productCount > 0)
  const featured = stocked.filter((category) => category.featuredOnHome)
  const pool = [
    ...featured,
    ...stocked.filter((category) => !category.featuredOnHome),
  ]
  // Keep the grid short on phones; the rest are one tap away.
  const limit = homeCategoryLimit && homeCategoryLimit > 0 ? homeCategoryLimit : HOME_CATEGORY_DEFAULT
  const categories = pool.slice(0, limit)
  const moreCategories = pool.length - categories.length

  return (
    <>
      <Container className="py-5 empty:hidden">
        <CampaignBanner />
      </Container>

      <HeroSection />

      <CategoriesRow categories={categories} moreCount={moreCategories} />

      {featuredProducts.length > 0 && (
        <TrendingCarousel products={featuredProducts} />
      )}

      <Section className="bg-[#FFF5F5]">
        <Container>
          <FeaturedCollections
            newArrivals={newArrivals}
            curatedPicks={curatedPicks}
          />
        </Container>
      </Section>

      <TestimonialsSection />

    </>
  )
}
