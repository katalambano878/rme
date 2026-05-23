import { AnnouncementBar } from "@/components/layout/announcement-bar"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CartDrawer } from "@/components/layout/cart-drawer"
import { createClient } from "@/lib/supabase/server"

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let announcement: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("storefront_settings")
      .select("announcement_bar")
      .eq("id", 1)
      .maybeSingle()
    announcement = data?.announcement_bar ?? null
  } catch {
    announcement = null
  }

  return (
    <>
      <AnnouncementBar message={announcement} />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </>
  )
}
