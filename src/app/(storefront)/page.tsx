import type { Metadata } from "next"
import { BRAND_NAME, BRAND_LEGAL_NAME, BRAND_TAGLINE, SITE_DOMAIN } from "@/lib/brand"
import { HeroSection } from "@/components/home/hero-section"
import { CampaignHero } from "@/components/campaign/campaign-hero"
import { CampaignEdit, type CampaignEditTab } from "@/components/campaign/campaign-edit"

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
  fetchProductsByCategorySlug,
  isCampaignShowing,
} from "@/lib/supabase/storefront-products"
import type { Product } from "@/types/product"

/** Gift-friendly rows for the Black Friday edit, loaded only while it shows. */
async function loadCampaignEdit(): Promise<CampaignEditTab[]> {
  if (!(await isCampaignShowing())) return []
  const [sets, packages, scents, serums, makeup, lips] = await Promise.all([
    fetchProductsByCategorySlug("skin-care-set", 8),
    fetchProductsByCategorySlug("gift-packages", 4),
    fetchProductsByCategorySlug("scents", 8),
    fetchProductsByCategorySlug("facial-serums", 8),
    fetchProductsByCategorySlug("makeup", 8),
    fetchProductsByCategorySlug("lip-care-lip-glosses", 8),
  ])
  const gifts: Product[] = [...packages, ...sets].slice(0, 8)
  return [
    { label: "Gift sets", href: "/shop?category=skin-care-set", products: gifts },
    { label: "Scents", href: "/shop?category=scents", products: scents },
    { label: "Skincare", href: "/shop?category=facial-serums", products: serums },
    { label: "Makeup", href: "/shop?category=makeup", products: makeup },
    { label: "Lip care", href: "/shop?category=lip-care-lip-glosses", products: lips },
  ]
}

const HOME_CATEGORY_DEFAULT = 8

export default async function HomePage() {
  const [newArrivals, curatedPicks, featuredProducts, allCategories, homeCategoryLimit, editTabs] =
    await Promise.all([
      fetchNewArrivals(8),
      fetchBestSellers(8),
      fetchTrendingProducts(6),
      fetchStorefrontCategoriesWithCounts(),
      fetchHomepageCategoryLimit(),
      loadCampaignEdit(),
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
      <CampaignHero products={editTabs[0]?.products ?? []}>
        <HeroSection />
      </CampaignHero>

      <CampaignEdit tabs={editTabs} />

      <CategoriesRow categories={categories} moreCount={moreCategories} />

      {featuredProducts.length > 0 && (
        <TrendingCarousel products={featuredProducts} />
      )}

      <Section className="border-t border-line bg-white">
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
