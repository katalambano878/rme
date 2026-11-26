import { AnnouncementBar } from "@/components/layout/announcement-bar"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CartDrawer } from "@/components/layout/cart-drawer"
import { StorePricingProvider } from "@/components/store-pricing-provider"
import { LiveShopperPing } from "@/components/live-shopper-ping"
import { createClient } from "@/lib/supabase/server"
import { fetchStorefrontCategoriesWithCounts } from "@/lib/supabase/storefront-products"
import { CampaignProvider } from "@/components/campaign/campaign-context"
import { CampaignBar } from "@/components/campaign/campaign-bar"
import { parseCampaign, type Campaign } from "@/lib/effective-price"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let announcement: string | null = null
  let campaign: Campaign | null = null
  let shopLinks: { href: string; label: string }[] = [
    { href: "/shop", label: "Shop All" },
    { href: "/admin/login", label: "RME" },
  ]
  try {
    const supabase = await createClient()
    const [{ data }, categories, { data: site }] = await Promise.all([
      supabase
        .from("storefront_settings")
        .select("announcement_bar")
        .eq("id", 1)
        .maybeSingle(),
      fetchStorefrontCategoriesWithCounts(),
      supabase.from("site_settings").select("feature_flags").eq("id", 1).maybeSingle(),
    ])
    announcement = data?.announcement_bar ?? null
    campaign = parseCampaign(site?.feature_flags)
    shopLinks = [
      { href: "/shop", label: "Shop All" },
      ...categories
        .filter((category) => category.parentId == null && category.name && category.slug)
        .map((category) => ({
          href: `/shop?category=${encodeURIComponent(category.slug)}`,
          label: category.name,
        })),
      { href: "/admin/login", label: "RME" },
    ]
  } catch {
    announcement = null
  }

  return (
    <StorePricingProvider>
      <CampaignProvider campaign={campaign} serverNow={Date.now()}>
      <div className="store flex min-h-full flex-1 flex-col">
        <CampaignBar>
          <AnnouncementBar message={announcement} />
        </CampaignBar>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer shopLinks={shopLinks} />
        <CartDrawer />
        <LiveShopperPing />
      </div>
      </CampaignProvider>
    </StorePricingProvider>
  )
}
