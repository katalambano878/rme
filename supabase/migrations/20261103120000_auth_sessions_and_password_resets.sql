-- Server-side sign-out for the plain-Postgres auth shim (src/lib/db/auth.ts).
-- A row with session_id NULL ends every session the user had at revoked_at
-- ("global" logout); a row with session_id ends that one session ("local").
-- The app also creates this table on first use.
create table if not exists public.auth_session_revocations (
  id bigserial primary key,
  user_id uuid not null,
  session_id uuid,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists auth_session_revocations_user_idx
  on public.auth_session_revocations (user_id);

-- Only the server's app pool uses it; like the other tables, no RLS (the app
-- role does not bypass RLS, so enabling it would lock the app out).

-- Forgot-password links: only a SHA-256 of the emailed token is stored.
create table if not exists public.auth_password_resets (
  token_hash text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists auth_password_resets_user_idx
  on public.auth_password_resets (user_id);

-- The app role needs the id sequence for inserts.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'rme_staging') then
    grant usage, select on sequence public.auth_session_revocations_id_seq to rme_staging;
  end if;
end $$;
