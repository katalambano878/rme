/**
 * Seed Carol Party MS3209 clutch+heels sets + category images.
 * Usage: DATABASE_URL=... node scripts/seed-ms3209-products.mjs
 */
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const products = [
  {
    name: "Carol Party Crystal Clutch & Heels Set — Gold",
    slug: "carol-party-ms3209-gold",
    sku: "MS3209-GOLD",
    color: "Gold",
    image: "/images/products/ms3209-gold.png",
    categorySlug: "featured",
    price: 450,
    compareAt: 550,
    salePrice: null,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    badges: ["Best Seller"],
  },
  {
    name: "Carol Party Crystal Clutch & Heels Set — Purple",
    slug: "carol-party-ms3209-purple",
    sku: "MS3209-PURPLE",
    color: "Purple",
    image: "/images/products/ms3209-purple.png",
    categorySlug: "new-arrivals",
    price: 450,
    compareAt: 550,
    salePrice: null,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    badges: ["New"],
  },
  {
    name: "Carol Party Crystal Clutch & Heels Set — Coffee",
    slug: "carol-party-ms3209-coffee",
    sku: "MS3209-COFFEE",
    color: "Coffee",
    image: "/images/products/ms3209-coffee.png",
    categorySlug: "best-sellers",
    price: 450,
    compareAt: 550,
    salePrice: null,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: true,
    badges: ["Best Seller"],
  },
  {
    name: "Carol Party Crystal Clutch & Heels Set — Wine",
    slug: "carol-party-ms3209-wine",
    sku: "MS3209-WINE",
    color: "Wine",
    image: "/images/products/ms3209-wine.png",
    categorySlug: "preorders",
    price: 450,
    compareAt: 550,
    salePrice: 380,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: false,
    badges: ["Sale"],
  },
]

const categoryImages = {
  featured: "/images/categories/featured.png",
  "new-arrivals": "/images/categories/new-arrivals.png",
  "best-sellers": "/images/categories/best-sellers.png",
  preorders: "/images/categories/preorders.png",
  sale: "/images/categories/preorders.png",
}

const description = `Matching Carol Party evening set (model MS3209): pointed-toe slingback kitten heels paired with a rectangular crystal-embellished clutch and gold-tone chain strap. Perfect for parties, bridal events, and formal occasions.`

const shortDescription = `Matching crystal clutch and slingback heels set — model MS3209.`

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    for (const [slug, imageUrl] of Object.entries(categoryImages)) {
      const r = await client.query(
        `UPDATE categories SET image_url = $1 WHERE slug = $2 RETURNING id, name`,
        [imageUrl, slug],
      )
      if (r.rowCount) console.log("category image:", r.rows[0].name, "→", imageUrl)
      else console.warn("category missing:", slug)
    }

    for (const p of products) {
      const cat = await client.query(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [p.categorySlug],
      )
      if (!cat.rowCount) throw new Error(`Category not found: ${p.categorySlug}`)
      const categoryId = cat.rows[0].id

      const existing = await client.query(
        `SELECT id FROM products WHERE slug = $1 LIMIT 1`,
        [p.slug],
      )

      let productId
      if (existing.rowCount) {
        productId = existing.rows[0].id
        await client.query(
          `UPDATE products SET
            name = $2, description = $3, short_description = $4,
            category_id = $5::uuid, status = 'active',
            is_featured = $6, is_new_arrival = $7, is_best_seller = $8,
            badges = $9::text[], price = $10, compare_at_price = $11,
            sale_price = $12, sku = $13, quantity = 25,
            delivery_estimate = '2–5 business days',
            seo_title = $14, seo_description = $15,
            updated_at = NOW()
           WHERE id = $1::uuid`,
          [
            productId,
            p.name,
            description,
            shortDescription,
            categoryId,
            p.is_featured,
            p.is_new_arrival,
            p.is_best_seller,
            p.badges,
            p.price,
            p.compareAt,
            p.salePrice,
            p.sku,
            `${p.name} | Trust Link Mall`,
            shortDescription,
          ],
        )
        console.log("updated product:", p.slug)
      } else {
        const ins = await client.query(
          `INSERT INTO products (
            category_id, name, slug, description, short_description,
            status, is_featured, is_new_arrival, is_best_seller, badges,
            rating_avg, review_count, delivery_estimate,
            seo_title, seo_description, price, compare_at_price, sale_price,
            sku, quantity, moq, tags, metadata
          ) VALUES (
            $1::uuid, $2, $3, $4, $5,
            'active', $6, $7, $8, $9::text[],
            4.9, 12, '2–5 business days',
            $10, $11, $12, $13, $14,
            $15, 25, 1, $16::text[], $17::jsonb
          ) RETURNING id`,
          [
            categoryId,
            p.name,
            p.slug,
            description,
            shortDescription,
            p.is_featured,
            p.is_new_arrival,
            p.is_best_seller,
            p.badges,
            `${p.name} | Trust Link Mall`,
            shortDescription,
            p.price,
            p.compareAt,
            p.salePrice,
            p.sku,
            ["heels", "clutch", "evening", "ms3209", p.color.toLowerCase()],
            JSON.stringify({ model: "MS3209", brand: "Carol Party", color: p.color }),
          ],
        )
        productId = ins.rows[0].id
        console.log("inserted product:", p.slug, productId)
      }

      await client.query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [productId])
      await client.query(
        `INSERT INTO product_images (product_id, url, sort_order, alt)
         VALUES ($1::uuid, $2, 0, $3)`,
        [productId, p.image, p.name],
      )

      await client.query(`DELETE FROM variants WHERE product_id = $1::uuid`, [productId])
      await client.query(
        `INSERT INTO variants (product_id, sku, price, compare_at_price, sale_price, stock_quantity, option_values)
         VALUES ($1::uuid, $2, $3, $4, $5, 25, $6::jsonb)`,
        [
          productId,
          p.sku,
          p.price,
          p.compareAt,
          p.salePrice,
          JSON.stringify([{ name: "Color", value: p.color }]),
        ],
      )
    }

    await client.query("COMMIT")
    const count = await pool.query(`SELECT count(*)::int AS n FROM products WHERE status = 'active'`)
    console.log("active products:", count.rows[0].n)
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
