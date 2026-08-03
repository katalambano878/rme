#!/usr/bin/env bash
# Dry-run data integrity report for store_trustecom (no writes).
set -euo pipefail
source /data/fleet/secrets/store_trustecom.env

docker exec -i -e PGPASSWORD="$STORE_PASS" fleet-postgres \
  psql -U store_trustecom -d store_trustecom -v ON_ERROR_STOP=1 <<'SQL'
\echo '== Duplicate payment provider_refs (should be 0 groups) =='
SELECT provider_ref, count(*) FROM public.payments
WHERE provider_ref IS NOT NULL AND provider_ref <> ''
GROUP BY provider_ref HAVING count(*) > 1;

\echo '== Orders marked paid without paid payment =='
SELECT o.id, o.order_number, o.status
FROM public.orders o
WHERE o.status = 'paid'
AND NOT EXISTS (
  SELECT 1 FROM public.payments p
  WHERE p.order_id = o.id AND p.status = 'paid'
);

\echo '== Paid payments with amount mismatch vs order =='
SELECT p.id, o.order_number, p.amount AS paid_amount, o.grand_total
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
WHERE p.status = 'paid'
AND abs(p.amount - o.grand_total) > 0.01;

\echo '== Orphan order_items =='
SELECT oi.id FROM public.order_items oi
LEFT JOIN public.orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

\echo '== Row counts =='
SELECT 'orders' AS t, count(*) FROM public.orders
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'categories', count(*) FROM public.categories
UNION ALL SELECT 'callback_events', count(*) FROM public.callback_events
UNION ALL SELECT 'sms_attempts', count(*) FROM public.sms_attempts
UNION ALL SELECT 'profiles', count(*) FROM public.profiles;
SQL
