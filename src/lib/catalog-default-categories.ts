/**
 * Canonical storefront category list (order + slugs). Keep in sync with
 * supabase migrations that seed categories.
 */
export const CATALOG_DEFAULT_CATEGORIES = [
  { name: "Baby Products", slug: "baby-products", description: "Category for Baby Products", sort_order: 1 },
  { name: "Hair Appliances", slug: "hair-appliances", description: "Category for Hair Appliances", sort_order: 2 },
  { name: "Hair Products", slug: "hair-products", description: "Category for Hair Products", sort_order: 3 },
  { name: "Makeup", slug: "makeup", description: "Category for Makeup", sort_order: 4 },
] as const
