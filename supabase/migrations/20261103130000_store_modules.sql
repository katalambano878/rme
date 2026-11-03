-- Admin "Modules" switches (src/app/admin/modules). The page and the admin
-- menu read this table, but no earlier migration created it, so switches
-- could never be saved. A module with no row counts as on.
create table if not exists public.store_modules (
  id text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.store_modules enable row level security;
