# Performance Report — Trust Ecom

**Report date:** 2026-08-03  
**Scope:** Static code review + architecture assessment  
**Lighthouse / WebPageTest:** **Not measured in this pass** — no baseline scores to cite.

---

## 1. Executive Summary

Trust Ecom is a standard Next.js App Router ecommerce app with heavy **client-side Supabase (PostgREST)** usage in the admin panel and selective storefront components. The main performance risks are **unpaginated admin data loads**, **in-memory rate limiting**, **large/unoptimized imagery**, and **multiple round-trips under RLS** from the browser. No dedicated caching layer (Redis, CDN config in repo) was found.

Payment and fulfillment paths were hardened for security in this session; performance work remains largely **recommended**, not completed.

---

## 2. Known Bottlenecks

### 2.1 Admin unpaginated queries (High)

Several admin pages fetch **entire tables** into React state on mount:

| Page | Query pattern | Risk |
|------|---------------|------|
| `admin/orders/page.tsx` | All orders + items + payments, no `.limit()` | Memory, slow TTFB, large JSON over PostgREST |
| `admin/products/page.tsx` | All products + variants + images + all `order_items` for sales counts | Grows with catalog and order history |
| `admin/inventory/page.tsx` | All products + variants | Same |
| `admin/customers/page.tsx` | All profiles + all orders | Quadratic merge client-side |
| `admin/analytics/page.tsx` | Orders + order_items with joins for period | Heavy join payload to browser |

**Partial pagination exists:** support tickets and conversations use `.range()`. Dashboard home uses small `.limit()` slices.

### 2.2 Client-side PostgREST under RLS (Medium)

Admin pages import `supabase` from `@/lib/supabase` (browser client with anon key). Each interaction:

- Executes queries from the user's browser to Supabase
- Evaluates RLS per request
- Exposes query patterns in client bundle

**Impact:** Extra latency vs server-side SQL; harder to optimize with indexes from app layer; admin UI blocked if RLS misconfigured.

**Files affected:** Most `src/app/admin/**/*.tsx` client components, plus some storefront components (`testimonials-section`, `shop-by-occasion`, blog).

### 2.3 In-memory rate limits (Medium)

`src/lib/rate-limit.ts` stores counters in a process-local `Map`.

**Impact:** Under Coolify multi-instance or serverless scaling, limits reset per instance — ineffective for payment/chat abuse protection at scale.

**Used by:** Moolre/Paystack routes, chat, transcribe, speak.

### 2.4 Imagery (Medium)

| Source | Issue |
|--------|-------|
| Hero slides | `hero-section.tsx` references `/images/home/hero-pink-studio.png` and `hero-marble-garden.png` — **files not present in repo at audit** (404 risk or supplied at deploy) |
| Product images | Supabase Storage public URLs; no repo-wide image optimization pipeline |
| Legacy beauty assets | Prior brand images removed (`diya_dark.png`); product catalog images may still be large uploads from admin |
| Next.js `Image` | Used on hero with `sizes="100vw"` — good pattern, but source file weight unknown |

**User-reported context:** Beauty/product images may remain large on Storage without WebP variants or resize-on-upload.

### 2.5 Chat / AI routes (Medium)

- `POST /api/chat` — Groq API calls; rate limits exist but LLM latency dominates.
- Long system prompts + tool calls in `chat-tools.ts` increase token usage and response time.

### 2.6 Checkout flow (Low–Medium)

- Multiple client → API → Supabase round trips for order creation and payment redirect.
- No obvious request deduplication on double-submit (browser-dependent).

### 2.7 Database indexes (Partially addressed)

Migration `20260803140000_payment_integrity.sql` adds:

- `orders(order_number)`
- `payments(status, created_at desc)`

Broader admin query indexes (e.g. `orders.created_at`, `products.status`) rely on init migration defaults — not re-profiled.

---

## 3. Fixes Done (This Session)

| Area | Change | Performance effect |
|------|--------|-------------------|
| Payments | Centralized `fulfillPaidOrder` | Fewer duplicate stock/SMS operations on idempotent retry |
| Paystack init | Single server-side price pass | Slightly more DB reads on checkout, but correct totals |
| Health endpoint | Optional `select 1` via `pg` pool | Minimal overhead; only when probed |
| Payment indexes | New migration | Faster callback order lookup |

**Not done:** Pagination, Redis rate limits, image pipeline, Lighthouse tuning, CDN headers.

---

## 4. Recommended Next Steps

### Quick wins

1. **Paginate admin orders** — default 50 per page, server-side filters; keep aggregates in SQL (`count`, `sum`).
2. **Move admin list queries to API routes** — service role or SQL via `pg` after cutover; return paginated JSON only.
3. **Fix hero assets** — add optimized WebP/AVIF under `public/images/home/` or replace with smaller assets; verify deploy includes files.
4. **Product image upload** — resize to max width (e.g. 1200px) on upload in admin product form.

### Medium term

5. **Redis rate limiting** — shared store for payment and chat endpoints on VPS.
6. **Server Components for storefront catalog** — reduce client PostgREST where RLS allows; use existing `storefront-products.ts` patterns.
7. **Analytics pre-aggregation** — nightly job or materialized view for revenue charts instead of shipping raw `order_items` to Recharts.
8. **Apply payment integrity migration** — index benefits for webhook-heavy traffic.

### Measurement (before claiming improvements)

9. Run Lighthouse on `/`, `/shop`, `/products/[slug]`, `/checkout` — record LCP, INP, CLS.
10. Profile admin orders page with 1k+ orders in staging.
11. Enable Supabase query performance advisor on slow queries.

---

## 5. Caching & CDN

| Layer | Status |
|-------|--------|
| Next.js static generation | Mixed; many storefront pages are client-heavy |
| `revalidate` / ISR | Not systematically applied in audited files |
| Supabase CDN for Storage | Default Supabase public bucket URLs |
| HTTP cache headers | Not audited on API routes (`/api/health` is dynamic) |

---

## 6. Build & Runtime

- **Next.js 16.2.1** with `next build --webpack`
- **Dependencies:** framer-motion, recharts — add to client bundle weight on pages that import them
- **No** `@next/bundle-analyzer` in devDependencies — bundle size not measured this pass

---

## 7. Honest Limitations of This Report

- No production traffic metrics, APM, or Supabase dashboard screenshots were captured.
- No before/after Lighthouse scores — **baseline unknown**.
- Page-level UX performance for authenticated admin flows was not exercised (Requires credentials / manual review).
- Postgres migration may change performance characteristics; this report assumes **current Supabase stack**.

---

*Treat recommended steps as a prioritized backlog, not completed work.*
