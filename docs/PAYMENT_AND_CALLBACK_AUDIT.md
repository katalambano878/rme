# Payment & Callback Audit — Trust Ecom

**Audit date:** 2026-08-03  
**Stack:** Next.js API routes + Supabase (service role) — **not** plain Postgres  
**Providers audited:** Moolre, Paystack  
**Hubtel:** Not implemented (N/A)

---

## 1. Provider Summary

| Provider | Init | Callback / Webhook | Client verify | Currency |
|----------|------|-------------------|---------------|----------|
| **Paystack** | `POST /api/paystack/initialize` | `POST /api/paystack/webhook` | `GET /api/paystack/verify?reference=` | GHS |
| **Moolre** | `POST /api/payment/moolre` | `POST /api/payment/moolre/callback` | `POST /api/payment/moolre/verify` | GHS |
| **Hubtel** | — | — | — | N/A |

---

## 2. Shared Fulfillment Pipeline

All successful payment paths converge on:

**`src/lib/payments/fulfill-paid-order.ts`**

```
Gateway confirms success + amount OK
        │
        ▼
fulfillPaidOrder(supabase, { orderId, provider, providerRef, expectedAmount, paidAmount, ... })
        │
        ├─ Skip if payments already paid (idempotent)
        ├─ Upsert payments row (status=paid, provider_ref)
        ├─ Update orders.status → paid (from pending/awaiting_payment/processing only)
        ├─ reduceOrderStock(orderId)
        └─ sendOrderConfirmation() — email + SMS (best-effort)
```

**Amount tolerance:** ±0.01 GHS (`AMOUNT_TOLERANCE`).

**Status normalization:** `src/lib/payments/status.ts` — `normalizePaystackStatus`, `normalizeMoolreStatus`, `toDbPaymentStatus`.

---

## 3. Paystack Flow

### 3.1 Initialize — `POST /api/paystack/initialize`

1. Validates cart `items[]` (quantity bounds, product/variant IDs).
2. **Recomputes all prices server-side** from `products` / `variants` + `site_settings.feature_flags.sale_promotion_enabled`.
3. **Ignores client `shippingCost`** — loads `delivery_fee` from `site_settings` (default 25; pickup = 0).
4. Creates `orders` + `order_items` with computed totals.
5. Initializes Paystack transaction (amount in pesewas) with `reference = order_number`.
6. Returns authorization URL to client.

**Security:** Client cannot set arbitrary prices or shipping fees.

### 3.2 Verify — `GET /api/paystack/verify`

1. Rate limit: 10 req/min per IP (`RATE_LIMITS.payment`).
2. Calls Paystack `GET /transaction/verify/:reference`.
3. Loads order by `order_number = reference`.
4. On success: validates amount (`paidAmount/100` vs `grand_total`) and currency.
5. Calls `fulfillPaidOrder`.

### 3.3 Webhook — `POST /api/paystack/webhook`

1. Reads raw body; requires `x-paystack-signature`.
2. HMAC-SHA512 with `PAYSTACK_WEBHOOK_SECRET` (falls back to `PAYSTACK_SECRET_KEY`).
3. Inserts into `callback_events` (if table exists) for audit.
4. On `charge.success`:
   - Loads order by reference.
   - **Amount mismatch → log to `webhook_logs`, return 200 without fulfilling.**
   - Match → `fulfillPaidOrder`.
5. Always returns `{ received: true }` on valid signature (Paystack retry semantics).

---

## 4. Moolre Flow

### 4.1 Initiate link — `POST /api/payment/moolre`

1. Rate limited (10/min).
2. Loads order by UUID or `order_number`; rejects if already paid.
3. **Amount from `orders.grand_total` only** — never from client body.
4. Generates `externalref = {order_number}-R{timestamp}` for retry uniqueness.
5. Persists **pending** `payments` row with `provider_ref = externalref` (critical for verify).
6. POST to `https://api.moolre.com/embed/link` with callback URL and optional `secret` field.
7. Returns `authorization_url` to client.

**Env required:** `MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER`.

### 4.2 Callback — `POST /api/payment/moolre/callback`

Primary async confirmation path.

```
Moolre POST → /api/payment/moolre/callback
```

**Security layers:**

| Check | Behavior |
|-------|----------|
| Rate limit | 50/min per IP |
| `MOOLRE_CALLBACK_SECRET` env | If unset → **503**, all callbacks rejected |
| `body.secret` | Must match env exactly → else **403** |
| Order reference | Strip `-R{timestamp}` suffix from `externalref` |
| Amount | Required in callback payload → else **400** |
| Amount match | Compared to `orders.grand_total` in `fulfillPaidOrder` |

**Payload shape:** Nested under `body.data` (`transactionid`, `externalref`, `amount`, `txstatus`).

**Logging:** Inserts to `webhook_logs` (non-fatal on failure).

**Failure path:** Sets order status back to `pending` (does not mark paid).

### 4.3 Verify — `POST /api/payment/moolre/verify`

Fallback after customer redirect when callback is delayed.

1. Rate limited.
2. Loads order + `payments.provider_ref`.
3. Polls `https://api.moolre.com/embed/status` with stored `externalref` (and fallbacks).
4. Validates amount when provided by API.
5. Calls `fulfillPaidOrder` on success.

---

## 5. Hubtel

**Status: N/A**

- No routes under `/api/payment/hubtel` or similar.
- No Hubtel env vars in `.env.example`.
- No code references in repository.

---

## 6. Idempotency

### Application layer

- `fulfillPaidOrder` checks existing `payments` for paid status → returns `{ ok: true, alreadyPaid: true }`.
- Order update uses conditional `.in("status", ["pending", "awaiting_payment", "processing"])`.
- Duplicate provider_ref insert errors treated as likely race (logged; may still proceed).

### Database layer (`20260803140000_payment_integrity.sql`)

| Index / constraint | Purpose |
|--------------------|---------|
| `payments_provider_ref_unique` | Unique `provider_ref` when not null |
| `payments_order_provider_paid_unique` | One paid row per order+provider |
| `callback_events_gateway_external_unique` | Dedupe webhook events by gateway + external ID |
| `orders_order_number_idx` | Faster order lookup in callbacks |

**Note:** Migration must be applied to production Supabase for DB-level guarantees.

---

## 7. Signature & Authentication Matrix

| Endpoint | Auth mechanism |
|----------|----------------|
| Paystack webhook | HMAC-SHA512 (`x-paystack-signature`) |
| Moolre callback | Shared secret in JSON body (`secret` field) |
| Paystack verify | Public + rate limit (relies on Paystack API auth server-side) |
| Moolre verify | Public + rate limit |
| Paystack initialize | Public (creates order) |
| Moolre init | Public (existing order required) |

---

## 8. Amount Validation

| Path | Validation |
|------|------------|
| Paystack initialize | Server computes total; Paystack charged that amount |
| Paystack verify | `amountsMatch(paidAmount, grand_total)` |
| Paystack webhook | Same; mismatch logged, no fulfill |
| Moolre init | Amount sent to Moolre = `grand_total` from DB |
| Moolre callback | Parse callback amount; enforce in `fulfillPaidOrder` |
| Moolre verify | API amount compared; falls back to expected if API omits amount |

**Checkout UI note:** Storefront checkout page hardcodes `shippingCost = 0` in UI while server may add delivery fee on Paystack initialize — potential display mismatch (UX, not a security bypass).

---

## 9. Reconciliation Script

**File:** `scripts/reconcile-payments.mjs`

```bash
node scripts/reconcile-payments.mjs          # report only
node scripts/reconcile-payments.mjs --apply  # safe updates only
```

**Behavior:**

- Lists `payments` with `status=pending` older than 30 minutes (limit 100).
- **Report mode (default):** prints payment/order details only.
- **Apply mode:** For Paystack only, calls verify API; marks `failed` if status is `failed` or `abandoned`.
- **Does not auto-mark success** — prevents fraudulent fulfillment from stale pending rows.

**Requires:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; optional `PAYSTACK_SECRET_KEY`.

**Not scheduled:** No cron configured in repo.

---

## 10. POS & Manual Paid Path

- Admin POS (`src/app/admin/pos/page.tsx`) calls RPC `mark_order_paid` — **not** the Paystack/Moolre pipeline.
- RPC definition not in local migrations; must exist in remote Supabase.

---

## 11. Remaining Payment Risks

| Risk | Mitigation status |
|------|-------------------|
| Duplicate SMS/email under concurrent callbacks | Partial — order update is conditional; notifications may duplicate |
| `sms_attempts` table unused | Migration added; logging not wired |
| Moolre callback without amount field | Rejected with 400 |
| Missing `MOOLRE_CALLBACK_SECRET` in prod | All Moolre callbacks fail closed (503/403) |
| Reconcile script doesn't cover Moolre pending | Manual review or extend script |
| Webhook log table growth | No retention policy |

---

## 12. Required Environment Variables

From `.env.example` (names only — never commit values):

```
PAYSTACK_SECRET_KEY
PAYSTACK_WEBHOOK_SECRET
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
MOOLRE_API_USER
MOOLRE_API_PUBKEY
MOOLRE_ACCOUNT_NUMBER
MOOLRE_CALLBACK_SECRET      # required for callbacks
MOOLRE_MERCHANT_EMAIL       # optional
```

---

## 13. Manual Verification Checklist

- [ ] Apply payment integrity migration to Supabase
- [ ] Configure `MOOLRE_CALLBACK_SECRET` in Moolre dashboard and env
- [ ] Test Paystack test transaction → verify + webhook both fulfill once
- [ ] Test Moolre callback with valid/invalid secret
- [ ] Confirm `payments.provider_ref` populated after Moolre init
- [ ] Run reconcile script in report mode against staging data

---

*Payments run on Supabase today. Postgres cutover must preserve callback URLs and env secrets on the VPS deployment.*
