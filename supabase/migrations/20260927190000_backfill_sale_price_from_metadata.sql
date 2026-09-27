-- Older product saves stored the admin "Sales (GH₵)" amount only in
-- metadata.sales_price. Sale mode reads products.sale_price, so those
-- prices never changed. Copy a lower promotional amount into the column
-- when the column is still empty.
UPDATE products AS p
SET sale_price = c.meta_sale
FROM (
  SELECT
    p2.id,
    CASE
      WHEN COALESCE(p2.metadata->>'sales_price', '') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p2.metadata->>'sales_price')::numeric
      WHEN COALESCE(p2.metadata->>'sale_price', '') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p2.metadata->>'sale_price')::numeric
      ELSE NULL
    END AS meta_sale,
    COALESCE(
      (
        SELECT MIN(v.price)
        FROM variants v
        WHERE v.product_id = p2.id
          AND v.price > 0
      ),
      NULLIF(p2.price, 0)
    ) AS anchor
  FROM products p2
  WHERE p2.sale_price IS NULL
) AS c
WHERE p.id = c.id
  AND c.meta_sale IS NOT NULL
  AND c.meta_sale > 0
  AND c.anchor IS NOT NULL
  AND c.meta_sale < c.anchor;
