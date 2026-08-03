import { query, queryOne } from "@/lib/db"

const ORDER_ADMIN_SELECT = `
  o.*,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('status', p.status, 'provider', p.provider, 'amount', p.amount))
     FROM payments p WHERE p.order_id = o.id),
    '[]'::jsonb
  ) AS payments,
  COALESCE(
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', oi.id,
         'quantity', oi.quantity,
         'name_snapshot', oi.name_snapshot,
         'unit_price', oi.unit_price,
         'line_total', oi.line_total,
         'product_id', oi.product_id,
         'variant_id', oi.variant_id,
         'sku_snapshot', oi.sku_snapshot
       )
     )
     FROM order_items oi WHERE oi.order_id = o.id),
    '[]'::jsonb
  ) AS order_items,
  CASE WHEN pr.id IS NULL THEN NULL
       ELSE jsonb_build_object('full_name', pr.full_name, 'email', pr.email, 'phone', pr.phone)
  END AS profiles
`

export async function listOrdersAdmin(filters?: {
  status?: string
  search?: string
  limit?: number
}) {
  const params: unknown[] = []
  const where: string[] = []
  let i = 1

  if (filters?.status && filters.status !== "all") {
    where.push(`o.status = $${i}::order_status`)
    params.push(filters.status)
    i++
  }

  if (filters?.search?.trim()) {
    params.push(`%${filters.search.trim()}%`)
    where.push(
      `(o.order_number ILIKE $${i} OR o.guest_email ILIKE $${i} OR o.guest_phone ILIKE $${i})`,
    )
    i++
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  const limitSql = filters?.limit ? `LIMIT $${i}` : ""
  if (filters?.limit) params.push(filters.limit)

  const result = await query(
    `SELECT ${ORDER_ADMIN_SELECT}
     FROM orders o
     LEFT JOIN profiles pr ON pr.id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC
     ${limitSql}`,
    params,
  )
  return result.rows
}

export async function getOrderByIdAdmin(id: string) {
  return queryOne(
    `SELECT ${ORDER_ADMIN_SELECT}
     FROM orders o
     LEFT JOIN profiles pr ON pr.id = o.user_id
     WHERE o.id::text = $1 OR o.order_number = $1
     LIMIT 1`,
    [id],
  )
}
