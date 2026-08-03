import { AnnouncementBar } from "@/components/layout/announcement-bar"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { CartDrawer } from "@/components/layout/cart-drawer"
import { fetchStorefrontAnnouncement } from "@/lib/storefront-content"

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const announcement = await fetchStorefrontAnnouncement()

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
