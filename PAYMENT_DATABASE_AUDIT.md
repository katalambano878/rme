# Payment Database Audit — RME

Hubtel: **not present** in codebase.

## Tables

- `orders` — trusted `grand_total`, `order_number` unique, status enum  
- `payments` — provider, provider_ref, amount, status; unique provider_ref; one paid per order  
- `webhook_logs` — audit only (not yet used for dedup keys)  
- `inventory_movements` — stock idempotency for order+variant  

## Moolre

| Concern | Status |
|---------|--------|
| Amount from DB on init | Yes |
| Callback amount compare | Yes |
| Failure cannot unpay | Yes (app + DB trigger) |
| Stock on success | Yes via `reduceOrderStock` |
| Callback secret | Optional — strengthen if Moolre sends it |
| Duplicate payments | Deduped; unique indexes added |

## Paystack

| Concern | Status |
|---------|--------|
| Server-side cart total on init | Yes |
| Verify/webhook amount check | **Fixed** (0.01 tolerance) |
| Idempotent paid handling | **Fixed** |
| Stock on success | **Fixed** (was missing) |
| HMAC webhook | Yes |
| Failure overwriting paid | **Fixed** (app + trigger) |

## Data cleanup performed

- 6 duplicate paid payment pairs collapsed  
- 9 duplicate inventory movement rows removed  
- 4 delivered orders still have no payments (legacy) — left untouched  

## Recommended ops

- Register Paystack webhook + Moolre callback to `https://ronnyandme.com/...`  
- Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `MOOLRE_*` in Coolify  
- Monitor `webhook_logs` for spikes  
