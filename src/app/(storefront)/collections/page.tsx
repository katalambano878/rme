import CollectionsPageClient from "./collections-client"
import { fetchStorefrontCategoriesWithCounts } from "@/lib/supabase/storefront-products"

export default async function CollectionsPage() {
  const categories = await fetchStorefrontCategoriesWithCounts()
  return <CollectionsPageClient categories={categories} />
}
