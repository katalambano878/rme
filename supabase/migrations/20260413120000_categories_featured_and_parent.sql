-- Admin categories UI: featured on homepage + optional hierarchy (safe if columns already exist)
alter table public.categories
  add column if not exists featured_on_home boolean not null default false;

alter table public.categories
  add column if not exists parent_id uuid references public.categories (id) on delete set null;
