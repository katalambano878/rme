import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('products','product_images','variants','categories')
    ORDER BY table_name, ordinal_position
  `)
  console.log("--- columns ---")
  for (const r of cols.rows) console.log(`${r.table_name}.${r.column_name} (${r.data_type})`)

  const cats = await pool.query(`
    SELECT id, name, slug, image_url, is_active, sort_order
    FROM categories
    ORDER BY sort_order NULLS LAST, name
  `)
  console.log("\n--- categories ---")
  console.log(JSON.stringify(cats.rows, null, 2))

  const prods = await pool.query(`SELECT count(*)::int AS n FROM products`)
  console.log("\nproduct count:", prods.rows[0].n)

  const sample = await pool.query(`
    SELECT id, name, slug, sku, price, sale_price, category_id, is_active, is_featured
    FROM products LIMIT 3
  `)
  console.log("sample products:", JSON.stringify(sample.rows, null, 2))

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
