import CollectionsPageClient from "./collections-client"
import { fetchStorefrontCategoriesWithCounts } from "@/lib/data/storefront-products"

export default async function CollectionsPage() {
  let categories: Awaited<ReturnType<typeof fetchStorefrontCategoriesWithCounts>> = []
  try {
    categories = await fetchStorefrontCategoriesWithCounts()
  } catch (err) {
    console.error("[collections] categories failed:", err)
  }
  return <CollectionsPageClient categories={categories} />
}
