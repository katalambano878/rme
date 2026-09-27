import { AnnouncementBar } from "@/components/layout/announcement-bar"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CartDrawer } from "@/components/layout/cart-drawer"
import { createClient } from "@/lib/supabase/server"
import { fetchStorefrontCategoriesWithCounts } from "@/lib/supabase/storefront-products"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let announcement: string | null = null
  let shopLinks: { href: string; label: string }[] = [
    { href: "/shop", label: "Shop All" },
    { href: "/admin/login", label: "RME" },
  ]
  try {
    const supabase = await createClient()
    const [{ data }, categories] = await Promise.all([
      supabase
        .from("storefront_settings")
        .select("announcement_bar")
        .eq("id", 1)
        .maybeSingle(),
      fetchStorefrontCategoriesWithCounts(),
    ])
    announcement = data?.announcement_bar ?? null
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
    <>
      <AnnouncementBar message={announcement} />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer shopLinks={shopLinks} />
      <CartDrawer />
    </>
  )
}
