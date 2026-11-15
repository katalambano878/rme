-- Live shoppers, daily visitor counts, and supplier cost for profit margins.

create table if not exists public.live_sessions (
  visitor_id text primary key,
  page text not null,
  stage text not null,
  cart_items int not null default 0,
  cart_value numeric(12,2) not null default 0,
  last_seen timestamptz not null default now()
);

create table if not exists public.site_visits (
  id bigserial primary key,
  visitor_id text not null,
  visited_at timestamptz not null default now()
);

create index if not exists site_visits_visitor_day_idx
  on public.site_visits (visitor_id, visited_at);

create table if not exists public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  supplier_name text,
  cost_price numeric(12,2) not null,
  notes text,
  updated_at timestamptz not null default now()
);
