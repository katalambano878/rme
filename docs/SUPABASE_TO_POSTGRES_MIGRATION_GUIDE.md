# Supabase → Plain Postgres Migration Guide — Trust Ecom

**Target pattern:** Mamator on big VPS (fleet CLI, `store_*` databases, local disk uploads)  
**Status as of 2026-08-03:** **Not started** — app still runs on Supabase Auth + PostgREST + Storage + RLS  
**This guide describes how to complete cutover**, not current production state.

---

## 1. Overview

Trust Ecom will migrate from managed Supabase to:

| Supabase feature | Replacement on VPS |
|------------------|-------------------|
| Postgres (hosted) | `store_trustecom` on fleet Postgres (`DATABASE_URL`) |
| Supabase Auth | Custom auth (credentials + sessions in app or shared fleet pattern) |
| PostgREST / JS client | `src/lib/db.ts` (`pg`) + SQL repositories |
| RLS | Application-level authorization (middleware + role checks) |
| Storage (`product-images`) | `/var/www/trustecom/uploads` + Next.js/nginx static serve |
| Realtime | N/A (not used) |
| Edge Functions | N/A (not used) |

**Completion criteria:** Zero `@supabase/*` imports in runtime app code (routes, server components, middleware, client data layer). Scripts in `scripts/` may use `pg` only.

---

## 2. Prerequisites

- SSH access to big VPS (`ssh big-vps`)
- Supabase project admin (export data, RPC definitions)
- Coolify app for Trust Ecom (or ability to deploy new app — owner UI may be required)
- Production secrets: payment keys, Resend, Groq, reCAPTCHA
- Staging environment recommended before production cutover

**Inventory command:**

```bash
ssh big-vps 'sudo fleet db list; sudo fleet apps'
```

At audit time **`store_trustecom` did not exist**.

---

## 3. Phase 1 — Provision Database

### 3.1 Create store database

```bash
ssh big-vps 'sudo fleet db provision trustecom'
```

Note the connection string output (or retrieve from fleet/Coolify secrets). Format:

```
DATABASE_URL=postgresql://store_trustecom:***@fleet-postgres:5432/store_trustecom
```

For local scripts / Coolify, set also:

```
DATABASE_SSL=false          # typical for internal VPS network
DATABASE_POOL_MAX=20
```

### 3.2 Build plain schema

1. Start from repo migrations in `supabase/migrations/` **in order**.
2. **Remove or rewrite Supabase-specific objects:**
   - References to `auth.users` → replace with local `users` table
   - `auth.uid()` in RLS → drop RLS or convert to app checks
   - Storage bucket SQL → skip; use filesystem paths
3. **Export missing RPCs** from live Supabase (Dashboard → Database → Functions):

   - `generate_ticket_number`
   - `mark_order_paid`
   - `get_support_dashboard_stats`
   - `get_ai_memories`
   - `upsert_customer_insight`
   - `upsert_chat_conversation`

4. Add exported SQL as new migration files under `supabase/migrations/` or a dedicated `postgres/schema/` directory for VPS apply.

5. Apply to `store_trustecom`:

```bash
# Example: psql apply (adjust host/user)
psql "$DATABASE_URL" -f supabase/migrations/20250324180000_init_store.sql
# ... repeat for each migration in order
```

**Validate:**

```bash
psql "$DATABASE_URL" -c "\dt public.*"
psql "$DATABASE_URL" -c "\df public.*"
```

---

## 4. Phase 2 — Data Migration

### 4.1 Export from Supabase

Option A — pg_dump (if direct connection allowed):

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-acl -f trustecom_public.sql
pg_dump "$SUPABASE_DB_URL" --data-only --table=public.products --table=public.orders ...
```

Option B — Supabase Dashboard backup / table CSV export for smaller datasets.

**Include tables:** profiles, products, variants, categories, orders, order_items, payments, site_settings, storefront_settings, support_*, chat_*, blog_*, coupons, etc.

**Auth users:** Export `auth.users` separately — required for password migration or forced reset.

### 4.2 Transform auth linkage

Init schema ties `profiles.id` → `auth.users.id`. For plain Postgres:

1. Create `public.users` with `id uuid`, `email`, `password_hash`, `created_at`.
2. Migrate `auth.users` rows → `users`.
3. Keep `profiles.id` FK → `users.id`.
4. Drop dependency on Supabase `auth` schema.

### 4.3 Import into store_trustecom

```bash
psql "$DATABASE_URL" -f trustecom_data.sql
```

Verify row counts match Supabase for critical tables.

---

## 5. Phase 3 — Storage Migration

### 5.1 Create upload directory on VPS

```bash
ssh big-vps 'sudo mkdir -p /var/www/trustecom/uploads/product-images && sudo chown -R tay:www-data /var/www/trustecom'
```

(Adjust user/group to match Coolify container mount.)

### 5.2 Copy objects from Supabase Storage

List bucket `product-images` via Supabase CLI or Dashboard; download each object.

Example pattern:

```bash
# Pseudocode — use supabase storage download or API
supabase storage cp ss:///product-images ./storage-export/ -r
rsync -av ./storage-export/ big-vps:/var/www/trustecom/uploads/product-images/
```

### 5.3 Update database paths

Replace Supabase public URLs in `product_images.url` / `storage_path` with:

```
/uploads/product-images/{path}
```

Or absolute CDN URL: `https://trustecom.com/uploads/product-images/{path}`

### 5.4 Serve files

**nginx** (or Coolify proxy) location block:

```nginx
location /uploads/ {
    alias /var/www/trustecom/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 5.5 Replace upload code

Replace `src/lib/supabase-storage.ts` usage in admin product forms with:

- `POST /api/admin/upload` writing to disk
- Return public path stored in `product_images`

---

## 6. Phase 4 — Replace Auth

### 6.1 Remove Supabase Auth dependencies

Files to refactor:

| File | Current |
|------|---------|
| `src/middleware.ts` | `createServerClient` session refresh |
| `src/lib/auth.ts` | `supabaseAdmin.auth.getUser` |
| `src/app/(storefront)/auth/*` | Supabase signIn/signUp |
| `src/app/admin/login/page.tsx` | Supabase login |
| `src/lib/hooks/use-admin-user.ts` | Auth state subscription |

### 6.2 Implement replacement

Follow mamator pattern if available in fleet template:

- HTTP-only session cookie (signed)
- Password verify with bcrypt/argon2
- `profiles.role` check unchanged
- Middleware validates session from cookie, loads user + role from Postgres

### 6.3 Admin allowlists

Migrate `superadmins` and `store_admins` tables — already in init migration.

---

## 7. Phase 5 — Replace Data Access Layer

### 7.1 Introduce repositories

Create modules e.g. `src/lib/repos/orders.ts` using `query()` from `src/lib/db.ts`:

```typescript
import { query, queryOne } from "@/lib/db"

export async function getOrderByNumber(orderNumber: string) {
  return queryOne(`select * from orders where order_number = $1`, [orderNumber])
}
```

### 7.2 Migration order (suggested)

1. **API routes** — payments, health, orders/track (server-only, high risk)
2. **Server components** — product pages, blog
3. **Admin API routes** — new `/api/admin/*` with pagination
4. **Admin UI** — switch from browser Supabase to fetch admin APIs
5. **Storefront client** — minimize client DB; prefer RSC + API

### 7.3 Payment routes

`fulfill-paid-order.ts` currently accepts `SupabaseClient`. Refactor to:

- Accept a transaction interface or use `withTransaction()` from `db.ts`
- Keep idempotency logic identical
- No behavior change for Moolre/Paystack secrets

### 7.4 Remove packages (final step)

```bash
npm uninstall @supabase/supabase-js @supabase/ssr
```

Delete unused files:

- `src/lib/supabase/*`
- `src/lib/supabase-admin.ts`
- `src/lib/supabase-storage.ts`

---

## 8. Phase 6 — Environment Mapping

### Remove after cutover verified

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
```

### Set for VPS runtime

```
DATABASE_URL=postgresql://...@fleet-postgres:5432/store_trustecom
DATABASE_SSL=false
NEXT_PUBLIC_APP_URL=https://trustecom.com
APP_BASE_URL=https://trustecom.com

# Auth (new — names depend on implementation)
SESSION_SECRET=
# or AUTH_SECRET, JWT_SECRET, etc.

# Payments (unchanged)
PAYSTACK_SECRET_KEY
PAYSTACK_WEBHOOK_SECRET
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
MOOLRE_API_USER
MOOLRE_API_PUBKEY
MOOLRE_ACCOUNT_NUMBER
MOOLRE_CALLBACK_SECRET

# SMS / Email (unchanged)
MOOLRE_SMS_API_KEY
RESEND_API_KEY
EMAIL_FROM
ADMIN_EMAIL
ADMIN_SMS_NUMBERS

# Optional
GROQ_API_KEY
RECAPTCHA_SECRET_KEY
NEXT_PUBLIC_RECAPTCHA_SITE_KEY
```

Update Moolre/Paystack callback URLs to production domain:

- `https://trustecom.com/api/payment/moolre/callback`
- `https://trustecom.com/api/paystack/webhook`

---

## Phase 7 — Deploy on Coolify / Fleet

1. Connect repo branch (e.g. `staging/plain-postgres` if following mamator branch naming).
2. Set env vars in Coolify UI — **never commit secrets**.
3. Mount volume for uploads:

   ```
   /var/www/trustecom/uploads → /app/public/uploads
   ```

   (Or serve purely from nginx outside container.)

4. Deploy and run smoke tests.

**Health check:**

```bash
curl -s https://trustecom.com/api/health | jq
```

Expect `database: "ok"` when `DATABASE_URL` is set.

---

## Phase 8 — Verification Checklist

### Database

- [ ] All migrations applied; RPCs exist
- [ ] Row counts match Supabase export
- [ ] `payments_provider_ref_unique` index present

### Auth

- [ ] Admin login works
- [ ] Customer signup/login works
- [ ] Middleware blocks non-staff from `/admin`

### Storefront

- [ ] Shop loads products with local image URLs
- [ ] Checkout creates order with server-side pricing
- [ ] Track order returns correct status

### Payments

- [ ] Paystack test transaction fulfills once
- [ ] Moolre callback with secret fulfills once
- [ ] Amount mismatch rejected
- [ ] `node scripts/reconcile-payments.mjs` updated to use `pg` instead of Supabase JS

### Admin

- [ ] Product CRUD + image upload to disk
- [ ] POS `mark_order_paid` equivalent works
- [ ] Support tickets create with ticket numbers

### Performance / ops

- [ ] Backups configured for `store_trustecom` (`/data/fleet/backups`)
- [ ] Cron for reconcile script (optional)

---

## 10. Rollback Plan

Until cutover is stable:

1. Keep Supabase project active (read-only freeze at cutover moment).
2. DNS can revert to prior deployment still pointing at Supabase-backed app.
3. Do not delete Supabase until **7+ days** stable production.

---

## 11. Scripts to Update Post-Cutover

| Script | Current | Target |
|--------|---------|--------|
| `scripts/reconcile-payments.mjs` | Supabase JS | `pg` queries |
| `scripts/create-admin-user.mjs` | Likely Supabase Auth | Local users table |
| Other `scripts/*.mjs` | Check each for `@supabase` | `pg` only |

---

## 12. Known Blockers

1. **`store_trustecom` not provisioned** on VPS yet.
2. **Six RPCs missing** from repo migrations — must export before schema parity.
3. **Admin UI** heavily uses browser Supabase — largest refactor surface.
4. **Auth migration** — no replacement implemented yet.
5. **Checkout UI shipping display** — fix separately (server vs UI fee mismatch).

---

## 13. Related Documents

- [`SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md`](./SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md) — feature matrix
- [`FULL_SYSTEM_AUDIT.md`](./FULL_SYSTEM_AUDIT.md) — current architecture
- [`PAYMENT_AND_CALLBACK_AUDIT.md`](./PAYMENT_AND_CALLBACK_AUDIT.md) — payment flows to preserve
- [`REPAIR_CHANGELOG.md`](./REPAIR_CHANGELOG.md) — foundation work already landed

---

## 14. Mamator Reference

Use the mamator store deployment on the same VPS as a template:

```bash
ssh big-vps 'sudo fleet apps; ls -la /var/www/mamator/uploads 2>/dev/null | head'
```

Align Trust Ecom with:

- `store_mamator` database naming → `store_trustecom`
- `DATABASE_URL` in Coolify env
- Local uploads instead of Supabase Storage
- Branch strategy used for mamator Postgres cutover (if documented in that repo's `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`)

---

**Remember:** Landing `src/lib/db.ts` and `/api/health` is preparation only. Cutover is complete when the storefront and admin run end-to-end on `store_trustecom` with no Supabase runtime dependencies.
