# Supabase → Postgres Database Report — RME

| Supabase feature | Previous | PostgreSQL replacement | Status |
|------------------|----------|------------------------|--------|
| PostgREST | Hosted API | `/rest/v1` + `supabase-compat` + `pg` | Working; writes now staff/service-gated |
| GoTrue Auth | Hosted Auth | `/auth/v1` + `auth.users` + jose JWT | Working |
| Storage | Supabase Storage | Local disk `/storage/v1` + `STORAGE_ROOT` | Working |
| RLS | DB policies | App middleware + REST authz + `requireAdmin` | Partial — policies exist but role is typically table owner |
| Realtime | Channels | Not used / removed | N/A |
| Edge functions | Deno | Next.js API routes | Migrated |
| RPC | `supabase.rpc` | SQL functions + compat `.rpc()` | `mark_order_paid`, support/chat helpers |
| Service role | Secret key | Same env name; server uses pool with full access | Working |
| Anon key | Public key | Still sent by browser client; not a DB role | Harmless with REST gates |

## Remaining `@supabase` usage (intentional)

- Browser: `@supabase/ssr` → same-origin URL  
- Server fallbacks when `DATABASE_URL` unset  
- Packages kept so UI code does not rewrite every query

## Auth migration

- Users live in `auth.users` with bcrypt passwords  
- Roles in `profiles.role` embedded in JWT `app_metadata.role`  
- Cookies: `sb-access-token`, `sb-refresh-token`
