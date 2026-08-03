import { query } from "@/lib/db"

type ImageInput = { url: string; sort_order?: number; alt?: string | null }
type VariantInput = {
  sku: string
  price: number
  compare_at_price?: number | null
  sale_price?: number | null
  stock_quantity?: number
  option_values?: unknown
}

export async function syncProductMedia(
  productId: string,
  images?: ImageInput[],
  variants?: VariantInput[],
) {
  if (images) {
    await query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [productId])
    for (const [idx, img] of images.entries()) {
      await query(
        `INSERT INTO product_images (product_id, url, sort_order, alt)
         VALUES ($1::uuid, $2, $3, $4)`,
        [productId, img.url, img.sort_order ?? idx, img.alt || null],
      )
    }
  }

  if (variants) {
    await query(`DELETE FROM variants WHERE product_id = $1::uuid`, [productId])
    for (const v of variants) {
      await query(
        `INSERT INTO variants (product_id, sku, price, compare_at_price, sale_price, stock_quantity, option_values)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          productId,
          v.sku,
          v.price,
          v.compare_at_price ?? null,
          v.sale_price ?? null,
          v.stock_quantity ?? 0,
          JSON.stringify(v.option_values ?? []),
        ],
      )
    }
  }
}
