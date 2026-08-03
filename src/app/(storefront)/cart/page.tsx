import CartPageClient from "./cart-client"
import { fetchBestSellers } from "@/lib/data/storefront-products"

export const dynamic = "force-dynamic"

export default async function CartPage() {
  let recommendations: Awaited<ReturnType<typeof fetchBestSellers>> = []
  try {
    recommendations = await fetchBestSellers(4)
  } catch (err) {
    console.error("[cart] recommendations failed:", err)
  }
  return <CartPageClient recommendations={recommendations} />
}
