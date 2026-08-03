# Supabase → Postgres Migration Report (Trust Ecom)

**Date:** 2026-08-03

## Feature matrix

| Supabase feature | Replacement | Status |
|------------------|-------------|---------|
| PostgREST queries | `pg` via `src/lib/db.ts` + `src/lib/data/*` + API routes | Done (runtime) |
| Supabase Auth | JWT cookie (`jose`) + `auth.users` bcrypt (`bcryptjs`) | Done |
| RLS | App-layer `verifyAuth` / middleware / role checks | Done (enforce in code) |
| Storage | `UPLOAD_DIR` + `/api/uploads` + next rewrite | Done |
| Realtime | Removed / not required for current UI | N/A |
| RPC | Inlined SQL / service helpers (e.g. stock reduction) | Done for payments/stock |
| Edge functions | Next.js route handlers | Done |
| Service role client | Server `pg` pool | Done |
| `@supabase/*` packages | Removed from `package.json` | Done |

## Auth model

- Table: `auth.users` (plain stub + `last_sign_in_at`)
- Profiles: `public.profiles` (roles: customer/staff/admin/superadmin)
- Session: HTTP-only cookie `trustecom_session` signed with `AUTH_SECRET`
- APIs: `/api/auth/login|signup|logout|me`

## Storage

- Write: `POST /api/uploads` (admin)
- Read: `GET /api/uploads/[...path]` + rewrite `/uploads/*`
- Env: `UPLOAD_DIR`, `NEXT_PUBLIC_UPLOAD_BASE_URL`

## Remaining / intentional leftovers

- Historical SQL under `supabase/migrations/` kept as schema source of truth for apply scripts
- Comments mentioning “supabase/migrations” in a few files
- Support tables may still need DDL if chat/support features are required in staging
