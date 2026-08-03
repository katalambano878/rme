/**
 * Seed additional storefront products (bags, heels, sets).
 * Usage: load DATABASE_URL then: node scripts/seed-more-products.mjs
 */
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const products = [
  // Extra listings from MS3209 images (alternate merchandising)
  {
    name: "Crystal Embellished Evening Clutch — Gold",
    slug: "crystal-evening-clutch-gold",
    sku: "CLUTCH-MS3209-GOLD",
    image: "/images/products/ms3209-gold.png",
    categorySlug: "best-sellers",
    price: 220,
    compareAt: 280,
    salePrice: null,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    badges: ["New", "Best Seller"],
    tags: ["clutch", "evening", "gold"],
    short: "Gold crystal clutch with chain strap — evening ready.",
    description:
      "Elegant hard-case evening clutch in metallic gold with crystal embellishment and a gold-tone chain strap. Style alone or pair with matching heels.",
  },
  {
    name: "Crystal Embellished Evening Clutch — Purple",
    slug: "crystal-evening-clutch-purple",
    sku: "CLUTCH-MS3209-PURPLE",
    image: "/images/products/ms3209-purple.png",
    categorySlug: "featured",
    price: 220,
    compareAt: 280,
    salePrice: null,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    badges: ["New", "Featured"],
    tags: ["clutch", "evening", "purple"],
    short: "Rich purple crystal clutch with gold chain detail.",
    description:
      "Statement purple evening clutch with crystal floral motif and gold-tone chain. Perfect for parties and formal events.",
  },
  {
    name: "Crystal Slingback Heels — Wine",
    slug: "crystal-slingback-heels-wine",
    sku: "HEELS-MS3209-WINE",
    image: "/images/products/ms3209-wine.png",
    categorySlug: "preorders",
    price: 280,
    compareAt: 360,
    salePrice: 240,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: false,
    badges: ["Sale"],
    tags: ["heels", "evening", "wine"],
    short: "Wine crystal slingback kitten heels on sale.",
    description:
      "Pointed-toe slingback kitten heels in wine with crystal vamp detail. Comfortable spool heel for evening wear.",
  },
  {
    name: "Crystal Slingback Heels — Coffee",
    slug: "crystal-slingback-heels-coffee",
    sku: "HEELS-MS3209-COFFEE",
    image: "/images/products/ms3209-coffee.png",
    categorySlug: "new-arrivals",
    price: 280,
    compareAt: 360,
    salePrice: null,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    badges: ["New"],
    tags: ["heels", "evening", "coffee"],
    short: "Coffee brown crystal slingback heels.",
    description:
      "Warm coffee satin slingbacks with amber crystal detailing and a flared kitten heel. Versatile for dinner and celebrations.",
  },
  // Lifestyle products from generated hero imagery
  {
    name: "Classic Structured Purse",
    slug: "classic-structured-purse",
    sku: "BAG-PURSE-001",
    image: "/images/home/hero-purse.png",
    categorySlug: "featured",
    price: 320,
    compareAt: 390,
    salePrice: null,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    badges: ["Best Seller"],
    tags: ["purse", "bag", "everyday"],
    short: "Structured everyday purse with refined finish.",
    description:
      "A classic structured purse for everyday polish. Spacious interior, clean lines, and a timeless silhouette that works day to night.",
  },
  {
    name: "Elegant Statement Heels",
    slug: "elegant-statement-heels",
    sku: "HEEL-STMT-001",
    image: "/images/home/hero-heels.png",
    categorySlug: "new-arrivals",
    price: 260,
    compareAt: 320,
    salePrice: null,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    badges: ["New"],
    tags: ["heels", "statement"],
    short: "Elevated heels with a modern silhouette.",
    description:
      "Statement heels designed for impact. Soft nude and blush tones with a refined heel height that balances comfort and style.",
  },
  {
    name: "Luxury Ladies Tote Bag",
    slug: "luxury-ladies-tote-bag",
    sku: "BAG-TOTE-001",
    image: "/images/home/hero-ladies-bag.png",
    categorySlug: "best-sellers",
    price: 380,
    compareAt: 460,
    salePrice: 340,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: true,
    badges: ["Sale", "Best Seller"],
    tags: ["tote", "bag", "ladies"],
    short: "Roomy luxury tote for work and weekend.",
    description:
      "A spacious ladies tote with soft structure and premium look. Ideal for work, travel, and everyday carry.",
  },
]

async function upsertProduct(client, p) {
  const cat = await client.query(
    `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
    [p.categorySlug],
  )
  if (!cat.rowCount) throw new Error(`Category missing: ${p.categorySlug}`)
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
        name=$2, description=$3, short_description=$4, category_id=$5::uuid,
        status='active', is_featured=$6, is_new_arrival=$7, is_best_seller=$8,
        badges=$9::text[], price=$10, compare_at_price=$11, sale_price=$12,
        sku=$13, quantity=30, tags=$14::text[],
        delivery_estimate='2–5 business days',
        seo_title=$15, seo_description=$16, updated_at=NOW()
       WHERE id=$1::uuid`,
      [
        productId,
        p.name,
        p.description,
        p.short,
        categoryId,
        p.is_featured,
        p.is_new_arrival,
        p.is_best_seller,
        p.badges,
        p.price,
        p.compareAt,
        p.salePrice,
        p.sku,
        p.tags,
        `${p.name} | Trust Link Mall`,
        p.short,
      ],
    )
    console.log("updated", p.slug)
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
        4.8, 8, '2–5 business days',
        $10, $11, $12, $13, $14,
        $15, 30, 1, $16::text[], '{}'::jsonb
      ) RETURNING id`,
      [
        categoryId,
        p.name,
        p.slug,
        p.description,
        p.short,
        p.is_featured,
        p.is_new_arrival,
        p.is_best_seller,
        p.badges,
        `${p.name} | Trust Link Mall`,
        p.short,
        p.price,
        p.compareAt,
        p.salePrice,
        p.sku,
        p.tags,
      ],
    )
    productId = ins.rows[0].id
    console.log("inserted", p.slug)
  }

  await client.query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [
    productId,
  ])
  await client.query(
    `INSERT INTO product_images (product_id, url, sort_order, alt)
     VALUES ($1::uuid, $2, 0, $3)`,
    [productId, p.image, p.name],
  )

  await client.query(`DELETE FROM variants WHERE product_id = $1::uuid`, [
    productId,
  ])
  await client.query(
    `INSERT INTO variants (product_id, sku, price, compare_at_price, sale_price, stock_quantity, option_values)
     VALUES ($1::uuid, $2, $3, $4, $5, 30, '[]'::jsonb)`,
    [productId, p.sku, p.price, p.compareAt, p.salePrice],
  )
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    for (const p of products) await upsertProduct(client, p)
    await client.query("COMMIT")
    const count = await pool.query(
      `SELECT count(*)::int AS n FROM products WHERE status = 'active'`,
    )
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
