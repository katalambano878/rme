import type { Metadata } from "next"
import { BRAND_NAME, BRAND_LEGAL_NAME, BRAND_TAGLINE, SITE_DOMAIN } from "@/lib/brand"
import { HeroSection } from "@/components/home/hero-section"

const siteUrl = `https://${SITE_DOMAIN}`

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Beauty & Skincare Essentials`,
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
    images: [{ url: "/opengraph-image.png", alt: `${BRAND_NAME} homepage` }],
  },
}
import { CategoriesRow } from "@/components/home/categories-row"
import { FeaturedCollections } from "@/components/home/featured-collections"
import { TrendingCarousel } from "@/components/home/trending-carousel"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { NewsletterSection } from "@/components/home/newsletter-section"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import {
  fetchNewArrivals,
  fetchBestSellers,
  fetchTrendingProducts,
  fetchHomepageCategoryLimit,
  fetchStorefrontCategoriesWithCounts,
} from "@/lib/supabase/storefront-products"

export default async function HomePage() {
  const [newArrivals, curatedPicks, featuredProducts, allCategories, homeCategoryLimit] =
    await Promise.all([
      fetchNewArrivals(4),
      fetchBestSellers(4),
      fetchTrendingProducts(6),
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

      <NewsletterSection />
    </>
  )
}
