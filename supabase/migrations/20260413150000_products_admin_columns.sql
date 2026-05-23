-- Admin ProductForm expects these columns on public.products (init_store only had core SEO/display fields).
alter table public.products add column if not exists price numeric(12, 2);
alter table public.products add column if not exists compare_at_price numeric(12, 2);
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists quantity int not null default 0;
alter table public.products add column if not exists moq int not null default 1;
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists metadata jsonb not null default '{}'::jsonb;
