-- Optional per-profile permission flags for future UI checks (RLP remains source of truth for data access).
alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;

comment on column public.profiles.permissions is 'Optional key/value flags for staff tooling; Postgres RLS remains the source of truth for data access.';
