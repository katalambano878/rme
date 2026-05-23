/**
 * Public media bucket for product & category images in Supabase Storage.
 * Must match `storage.buckets.id` in migrations (default: `product-images`).
 * Override with NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET if your project uses another name.
 */
export const SUPABASE_STORAGE_BUCKET =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
    ? process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
    : "product-images"
