# Repair Changelog — Trust Ecom Session

**Session date:** 2026-08-03  
**Focus:** Payment security hardening, migration foundation, Trust Ecom rebrand, audit documentation

This log covers files touched in the current working tree (git status at audit time). It does **not** imply production deployment or Postgres cutover completion.

---

## 1. New Files

| Path | Purpose |
|------|---------|
| `.env.example` | Documented env var names (Supabase, payments, SMS, optional `DATABASE_URL`) |
| `src/lib/db.ts` | Shared `pg` Pool for future plain Postgres (`DATABASE_URL`) |
| `src/lib/env.ts` | Env validation helpers for health checks |
| `src/lib/payments/fulfill-paid-order.ts` | Idempotent paid-order fulfillment (stock + notify) |
| `src/lib/payments/status.ts` | Payment status normalization (Paystack, Moolre) |
| `src/app/api/health/route.ts` | Public health endpoint (env + optional DB ping) |
| `scripts/reconcile-payments.mjs` | Report/apply script for stale pending payments |
| `public/brand/logo.png` | Trust Ecom logo asset |
| `supabase/migrations/20260803120000_rebrand_trust_ecom_defaults.sql` | Brand defaults in `storefront_settings` |
| `supabase/migrations/20260803140000_payment_integrity.sql` | Payment indexes, `callback_events`, `sms_attempts` |
| `docs/FULL_SYSTEM_AUDIT.md` | System audit (this documentation pass) |
| `docs/SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` | Migration matrix |
| `docs/PAYMENT_AND_CALLBACK_AUDIT.md` | Payment flow audit |
| `docs/PERFORMANCE_REPORT.md` | Performance findings |
| `docs/REPAIR_CHANGELOG.md` | This file |
| `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` | Cutover playbook |

---

## 2. Modified Files — Payments & API

| Path | Changes |
|------|---------|
| `src/app/api/payment/moolre/callback/route.ts` | Require `MOOLRE_CALLBACK_SECRET`; amount validation; `fulfillPaidOrder` |
| `src/app/api/payment/moolre/route.ts` | Persist `provider_ref` (externalref); amount from DB only |
| `src/app/api/payment/moolre/verify/route.ts` | Use stored externalref; amount check; `fulfillPaidOrder` |
| `src/app/api/paystack/initialize/route.ts` | Server-side pricing; ignore client `shippingCost`; delivery fee from settings |
| `src/app/api/paystack/verify/route.ts` | Amount + currency validation; `fulfillPaidOrder` |
| `src/app/api/paystack/webhook/route.ts` | HMAC verify; amount mismatch guard; `callback_events` insert; fulfill |
| `src/app/api/chat/route.ts` | Shared rate limit import (minor) |

---

## 3. Modified Files — Brand & Storefront

| Path | Changes |
|------|---------|
| `src/lib/brand.ts` | Trust Ecom identity (name, domain, contact placeholders) |
| `src/lib/catalog-default-categories.ts` | Rebrand-aligned defaults |
| `src/lib/mock-data.ts` | Trust Ecom sample content |
| `src/lib/site-knowledge.ts` | Chat/knowledge base brand strings |
| `src/lib/notifications.ts` | Trust Ecom email branding |
| `src/lib/chat-tools.ts` | Brand references in tool responses |
| `src/app/layout.tsx` | Metadata, favicon references |
| `src/app/manifest.ts` | PWA name/icons |
| `src/app/globals.css` | Theme tweaks |
| `src/components/home/hero-section.tsx` | Trust Ecom hero copy |
| `src/components/home/instagram-grid.tsx` | Brand strings |
| `src/components/home/newsletter-section.tsx` | Brand strings |
| `src/components/home/testimonials-section.tsx` | Brand strings |
| `src/components/layout/footer.tsx` | Contact/footer rebrand |
| `src/components/layout/search-overlay.tsx` | Brand strings |
| Storefront pages (`about`, `blog`, `checkout`, `contact`, `policies/*`, `products/*`, `account`, `auth/*`, `page.tsx`) | Copy/metadata rebrand |
| Storefront layouts (`about`, `blog`, `collections`, `contact`, `shop`) | SEO titles/descriptions |

---

## 4. Modified Files — Admin

| Path | Changes |
|------|---------|
| `src/app/admin/layout.tsx` | Brand in admin chrome |
| `src/app/admin/login/page.tsx` | Login branding |

---

## 5. Modified Files — Assets & Config

| Path | Changes |
|------|---------|
| `package.json` | Added `pg`; project name trust-ecom |
| `package-lock.json` | Lockfile update for `pg`, `@types/pg` |
| `README.md` | Trust Ecom setup notes |
| `supabase/README.md` | Migration notes |
| `supabase/seed.sql` | Brand-aligned seed data |
| `public/brand/icon-192.png` | Updated icon |
| `public/brand/icon-512.png` | Updated icon |
| `src/app/icon.png` | App icon |
| `src/app/apple-icon.png` | Apple touch icon |
| `src/app/opengraph-image.png` | OG image |

---

## 6. Deleted Files

| Path | Reason |
|------|--------|
| `public/brand/ronnyandme-logo.png` | Prior brand asset removed |
| `public/diya_dark.png` | Legacy beauty asset removed |

---

## 7. Migrations Added

| Migration | Apply target | Description |
|-----------|--------------|-------------|
| `20260803120000_rebrand_trust_ecom_defaults.sql` | Supabase SQL / `db push` | Updates `storefront_settings` defaults to Trust Ecom |
| `20260803140000_payment_integrity.sql` | Supabase SQL / `db push` | Unique payment refs, `callback_events`, `sms_attempts`, indexes |

**Manual action:** Run both against the **live Supabase project** if not already applied:

```bash
# From project root, with Supabase CLI linked:
supabase db push

# Or paste SQL into Supabase Dashboard → SQL Editor
```

---

## 8. Packages Added

| Package | Version | Purpose |
|---------|---------|---------|
| `pg` | ^8.20.0 | PostgreSQL client (foundation) |
| `@types/pg` | ^8.15.5 (dev) | TypeScript types |

Existing Supabase packages unchanged — app still depends on `@supabase/ssr` and `@supabase/supabase-js`.

---

## 9. Manual Actions Required

### Environment (production / staging)

Set or verify these **names** (values from your secret store):

- `MOOLRE_CALLBACK_SECRET` — **required** for Moolre callbacks to succeed
- `PAYSTACK_WEBHOOK_SECRET` — recommended (falls back to secret key)
- All vars in `.env.example` for payments, SMS, Supabase

### Supabase

1. Apply migrations listed in §7.
2. Export missing RPCs from remote project into new migration files:
   - `generate_ticket_number`, `mark_order_paid`, `get_support_dashboard_stats`
   - `get_ai_memories`, `upsert_customer_insight`, `upsert_chat_conversation`

### Operations

1. Run payment reconciliation (report first):
   ```bash
   node scripts/reconcile-payments.mjs
   ```
2. Optionally schedule reconcile with `--apply` after reviewing output (VPS cron — not configured in repo).

### VPS (future — not done)

- Provision `store_trustecom` — see migration guide
- Do **not** remove Supabase env vars until cutover verified

### Brand launch

- Fill phone, WhatsApp, social URLs in `src/lib/brand.ts`
- Ensure hero images exist at `public/images/home/` or update `hero-section.tsx`
- Set `NEXT_PUBLIC_APP_URL` to production domain

---

## 10. What Was NOT Changed

- No Hubtel integration added
- No Supabase Edge Functions added
- No admin pagination implemented
- No runtime cutover from Supabase to plain Postgres
- No SMS logging wired to `sms_attempts` table yet
- No git commit created by this documentation pass (unless explicitly requested)

---

## 11. Verification Suggestions

- [ ] `GET /api/health` returns env status (locally with `.env.local`)
- [ ] Paystack test payment → single fulfillment, stock reduced once
- [ ] Moolre callback rejected without secret; accepted with secret
- [ ] `npm run build` succeeds
- [ ] Admin login still works after middleware/session unchanged

---

*For architecture context see `docs/FULL_SYSTEM_AUDIT.md`. For cutover steps see `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`.*
