# Payment and Callback Audit — Trust Ecom

**Date:** 2026-08-03

## Gateways

| Gateway | In codebase | Status |
|---------|-------------|--------|
| Paystack | Yes | Converted to `pg`; server-side amount; verify + webhook → `fulfillPaidOrder` |
| Moolre | Yes | Converted to `pg`; callback secret required; verify + callback → `fulfillPaidOrder` |
| Hubtel | **No** | Not implemented — no routes, adapters, or env vars |

## Shared fulfillment

`src/lib/payments/fulfill-paid-order.ts`

1. Amount match (unless skip flag after trusted init)
2. Idempotent payment upsert / paid check
3. Order status → paid (conditional)
4. `reduceOrderStock(orderId)` once (inventory_movements reference)
5. Order confirmation (email/SMS) best-effort

## Callback routes

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/paystack/webhook` | POST | `PAYSTACK_WEBHOOK_SECRET` signature | Public to middleware |
| `/api/paystack/verify` | POST/GET | none (reference lookup + Paystack API) | Not sole success signal |
| `/api/payment/moolre/callback` | POST | `MOOLRE_CALLBACK_SECRET` | Public |
| `/api/payment/moolre/verify` | POST | server | |

## Integrity

- Expected amount from server-side order / DB prices
- Status normalization via `src/lib/payments/status.ts`
- `callback_events` / unique `provider_ref` when payment_integrity migration applied
- Reconciliation script: `scripts/reconcile-payments.mjs` (retarget to `DATABASE_URL` if still on old client)

## Manual staging checks

- [ ] Initialize Paystack with sandbox keys
- [ ] Initialize Moolre with sandbox keys
- [ ] Replay callback twice → one paid transition
- [ ] Amount mismatch rejected
- [ ] Invalid Moolre secret rejected
