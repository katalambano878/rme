import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const r = await pool.query(`
  SELECT pr.name, pr.slug, pi.url
  FROM products pr
  LEFT JOIN product_images pi ON pi.product_id = pr.id
  ORDER BY pr.name
`)
console.log(JSON.stringify(r.rows, null, 2))
await pool.end()
