import CartPageClient from "./cart-client"
import { fetchBestSellers } from "@/lib/supabase/storefront-products"

export default async function CartPage() {
  const recommendations = await fetchBestSellers(4)
  return <CartPageClient recommendations={recommendations} />
}
