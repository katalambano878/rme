# Payment Database Audit — Trust Ecom

**Audit date:** 2026-08-03  
**Database target:** `store_trustecom` (staging schema applied)  
**Runtime note:** Payment API routes still use **Supabase admin client** for reads/writes until cutover completes.

---

## Provider summary

| Provider | Implemented | DB `payments.provider` value | Init route | Callback / webhook | Verify route |
|----------|-------------|------------------------------|------------|-------------------|--------------|
| **Paystack** | Yes | `paystack` | `POST /api/paystack/initialize` | `POST /api/paystack/webhook` | `GET /api/paystack/verify` |
| **Moolre** | Yes | `moolre` | `POST /api/payment/moolre` | `POST /api/payment/moolre/callback` | `POST /api/payment/moolre/verify` |
| **Hubtel** | **No** | N/A | — | — | — |

**Hubtel:** Not implemented. No routes under `/api/payment/hubtel`, no Hubtel env vars in `src/lib/env.ts`, no Hubtel-specific tables.

**Currency:** GHS (Paystack amounts in pesewas at API boundary; stored as decimal GHS in `payments.amount`).

---

## Core payment tables

### `public.payments`

Primary payment record per gateway attempt.

| Column | Purpose |
|--------|---------|
| `order_id` | FK to `orders` |
| `provider` | `paystack` or `moolre` |
| `provider_ref` | Gateway transaction reference (Paystack `reference`, Moolre `externalref` / transaction id) |
| `amount` | Amount in GHS |
| `status` | `payment_status` enum |
| `raw_payload` | Optional gateway response snapshot |

**Fulfillment:** `src/lib/payments/fulfill-paid-order.ts` upserts paid rows and updates `orders.status`.

### `public.orders`

| Relevant columns | Purpose |
|------------------|---------|
| `order_number` | Paystack reference (often equals order number) |
| `status` | Set to `paid` on successful fulfillment |
| `grand_total` | Compared against paid amount (±0.01 tolerance) |

### `public.webhook_logs`

Generic debug log for webhook failures (e.g. Paystack amount mismatch). Older path; still used alongside `callback_events`.

### `public.callback_events`

Structured gateway callback audit (migration `20260803140000`).

| Column | Paystack usage | Moolre usage |
|--------|----------------|--------------|
| `gateway` | `paystack` | `moolre` |
| `external_event_id` | Paystack event/data id | Derived from payload |
| `reference` | Transaction reference | `externalref` |
| `signature_status` | `valid` after HMAC check | After secret validation |
| `processing_status` | `received` → updated on fulfill | Same pattern |

**Idempotency:** Unique index on `(gateway, external_event_id)` when `external_event_id` IS NOT NULL.

### `public.sms_attempts`

Outbound SMS audit after order confirmation (Moolre SMS API).

| Column | Purpose |
|--------|---------|
| `provider` | Default `moolre` |
| `related_order_id` | FK → `orders` |
| `related_payment_id` | FK → `payments` |
| `message_type`, `template_name` | e.g. order confirmation |
| `status`, `attempts`, `failure_reason` | Delivery tracking |

Not a payment gateway table — included in payment integrity migration for post-payment notifications.

---

## Integrity constraints (applied on `store_trustecom`)

From `supabase/migrations/20260803140000_payment_integrity.sql`:

| Constraint | Type | Purpose |
|------------|------|---------|
| `payments_provider_ref_unique` | Partial UNIQUE index | One row per non-empty `provider_ref` — prevents duplicate gateway refs |
| `payments_order_provider_paid_unique` | Partial UNIQUE index | At most one **paid** row per `(order_id, provider)` |
| `callback_events_gateway_external_unique` | Partial UNIQUE index | Dedupe webhook deliveries |
| `payments_status_created_idx` | Index | Admin/reporting queries by status |
| `orders_order_number_idx` | Index | Lookup by Paystack reference |
| `callback_events_reference_idx` | Index | Lookup by payment reference |
| `sms_attempts_order_type_idx` | Index | SMS history per order |

Migration is **additive** — no data deletion.

---

## Payment flows vs database writes

### Paystack

1. **Initialize** — Creates `orders` + `order_items` (server-side price recompute).
2. **Webhook / verify** — On success:
   - Insert `callback_events` (best-effort; non-fatal if table missing on old Supabase)
   - `fulfillPaidOrder` → upsert `payments` (`status=paid`, `provider_ref`), update `orders.status`
   - `reduceOrderStock`, `sendOrderConfirmation` (email + SMS)

**Signature:** HMAC-SHA512 (`x-paystack-signature`).

**Amount mismatch:** Logged to `webhook_logs`; fulfillment skipped; HTTP 200 returned to Paystack (retry-safe).

### Moolre

1. **Init** — Creates order + redirects to Moolre.
2. **Callback** — Validates `MOOLRE_CALLBACK_SECRET`, normalizes status, calls `fulfillPaidOrder`.
3. **Verify** — Client polling endpoint for success page.

**Rate limits:** Callback endpoint uses `RATE_LIMITS.callback`.

---

## Integrity verification

**Script:** `scripts/db-integrity-dry-run.sh` (read-only)

Checks:

1. Duplicate non-empty `payments.provider_ref`
2. Orders with `status = 'paid'` but no paid payment row
3. Paid payments where `amount` differs from `orders.grand_total` by > 0.01
4. Orphan `order_items`
5. Row counts for key tables

Run after data import or production cutover:

```bash
ssh big-vps 'bash /path/to/trust-ecom/scripts/db-integrity-dry-run.sh'
```

---

## Hubtel (N/A)

| Item | Status |
|------|--------|
| API routes | None |
| Env vars | None |
| `payments.provider = 'hubtel'` | Not used |
| Dedicated tables | None planned |

If Hubtel is added later, follow the same pattern: `payments` row per attempt, `callback_events` for webhooks, unique `provider_ref`, fulfillment via shared `fulfillPaidOrder`.

---

## Staging vs runtime gap

| Aspect | Staging PG schema | Application today |
|--------|-------------------|-------------------|
| Tables exist | Yes | Yes (on Supabase if migrated there) |
| Integrity indexes | Applied on `store_trustecom` | May differ on live Supabase until same migration run |
| Writes | Ready for `pg` | Still via `createAdminClient()` / `supabaseAdmin` |
| `callback_events` inserts | Table present | Code uses Supabase `.from('callback_events').insert()` |

**Testing payment DB on staging:** Requires retargeting payment routes to `DATABASE_URL` **or** temporarily pointing Supabase project at same schema (not current architecture).

---

## Site settings (provider toggles)

`site_settings.payment_providers` (seed):

```json
{
  "moolre": { "enabled": true },
  "paystack": { "enabled": false }
}
```

Gateway secrets remain in environment variables (`PAYSTACK_*`, `MOOLRE_*`), not in the database.

---

## Related code

| File | Role |
|------|------|
| `src/lib/payments/fulfill-paid-order.ts` | Idempotent paid fulfillment |
| `src/lib/payments/status.ts` | Status normalization |
| `src/app/api/paystack/*` | Paystack integration |
| `src/app/api/payment/moolre/*` | Moolre integration |
| `supabase/migrations/20260803140000_payment_integrity.sql` | DDL source |

See also [PAYMENT_AND_CALLBACK_AUDIT.md](./PAYMENT_AND_CALLBACK_AUDIT.md) for route-level security details.
