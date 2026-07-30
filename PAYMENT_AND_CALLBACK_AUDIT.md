# Payment & Callback Audit — RME

**Gateways in repo:** Moolre, Paystack  
**Hubtel:** Not present — no code paths, env vars, or routes.

## Moolre

| Step | Route / location | Status |
|------|------------------|--------|
| Initiate | `POST /api/payment/moolre` | Fixed — amount from DB; stores `provider_ref` = `${order}-R{ts}`; 20s timeout |
| Redirect | Moolre hosted → `/checkout/success?order=…&payment_success=true` | UI may show thanks early; DB update still requires callback/verify |
| Callback | `POST /api/payment/moolre/callback` | Uses `supabaseAdmin` (PG); strips `-R` suffix; secret check when provided; stock + SMS |
| Verify | `POST /api/payment/moolre/verify` | Fixed — tries stored `provider_ref` then bare order number; amount check; timeout |
| Duplicate protection | Payment status check before mark paid; stock via inventory_movements | Present |
| Amount trust | Server `grand_total` only | OK |

## Paystack

| Step | Route | Status |
|------|-------|--------|
| Initialize | `POST /api/paystack/initialize` | Server recomputes line prices; shipping now clamped to `site_settings.feature_flags.delivery_fee` |
| Redirect | `/checkout/callback?reference=…` | Calls verify API |
| Verify | `GET /api/paystack/verify` | Server-side Paystack API |
| Webhook | `POST /api/paystack/webhook` | HMAC with `PAYSTACK_WEBHOOK_SECRET` |
| Amount | Pesewas from server total | OK |

## Callback reachability

Middleware matcher explicitly allows `/api/payment/*` and `/api/paystack/*` without auth redirects.

## Recommended callback URLs (staging)

- Moolre callback: `https://rme-staging.169-58-8-203.sslip.io/api/payment/moolre/callback`
- Paystack webhook: `https://rme-staging.169-58-8-203.sslip.io/api/paystack/webhook`

## Test status

| Scenario | Result |
|----------|--------|
| Live sandbox payments | Not executed in this pass (no live charge authorization) |
| Code-path review | Completed |
| Staging HTTP smoke (pages/APIs) | Completed |

## Moolre SMS

- Sender: `src/lib/notifications.ts` → `https://api.moolre.com/open/sms/send`
- Env: `MOOLRE_SMS_API_KEY` / `MOOLRE_API_KEY`, `MOOLRE_SMS_SENDER_ID`
- Timeout: 15s (added)
- Admin debugger: `/admin/test-sms`
- Duplicate send: not fully ledgered yet — recommend `sms_logs` table in a follow-up
