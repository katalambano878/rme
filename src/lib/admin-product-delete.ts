import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deletes a product and dependent rows that match `init_store.sql` (variants cascade cart_items;
 * order_items must have variant_id cleared first; product delete may still fail if order_items reference the product).
 */
export async function deleteProductAndDependencies(
  supabase: SupabaseClient,
  productId: string,
): Promise<{ error: unknown }> {
  const { error: u1 } = await supabase
    .from('order_items')
    .update({ variant_id: null })
    .eq('product_id', productId)
  if (u1) return { error: u1 }

  const { error: e2 } = await supabase.from('product_images').delete().eq('product_id', productId)
  if (e2) return { error: e2 }

  const { error: e3 } = await supabase.from('variants').delete().eq('product_id', productId)
  if (e3) return { error: e3 }

  const { error: e4 } = await supabase.from('products').delete().eq('id', productId)
  if (e4) return { error: e4 }

  return { error: null }
}
