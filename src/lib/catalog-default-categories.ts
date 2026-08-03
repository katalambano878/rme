/**
 * Canonical storefront category list (order + slugs). Keep in sync with
 * supabase seed / migrations that seed categories.
 */
export const CATALOG_DEFAULT_CATEGORIES = [
  { name: "Featured", slug: "featured", description: "Featured products", sort_order: 1 },
  { name: "New Arrivals", slug: "new-arrivals", description: "Latest products", sort_order: 2 },
  { name: "Best Sellers", slug: "best-sellers", description: "Customer favorites", sort_order: 3 },
  { name: "Sale", slug: "sale", description: "Deals and discounts", sort_order: 4 },
] as const
