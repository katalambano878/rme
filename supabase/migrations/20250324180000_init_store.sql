  -- Storefront core schema + RLS
  -- Apply in Supabase SQL Editor or: supabase db push

  -- -----------------------------------------------------------------------------
  -- Extensions
  -- -----------------------------------------------------------------------------
  create extension if not exists "pgcrypto";

  -- -----------------------------------------------------------------------------
  -- Enums
  -- -----------------------------------------------------------------------------
  do $$ begin
    create type public.user_role as enum ('customer', 'staff', 'admin', 'superadmin');
  exception when duplicate_object then null;
  end $$;

  do $$ begin
    create type public.order_status as enum (
      'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
    );
  exception when duplicate_object then null;
  end $$;

  do $$ begin
    create type public.payment_status as enum (
      'pending', 'authorized', 'paid', 'failed', 'refunded'
    );
  exception when duplicate_object then null;
  end $$;

  -- -----------------------------------------------------------------------------
  -- Profiles (1:1 auth.users) — RBAC
  -- -----------------------------------------------------------------------------
  create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    full_name text,
    phone text,
    avatar_url text,
    role public.user_role not null default 'customer',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

create index if not exists profiles_email_idx on public.profiles (email);

-- -----------------------------------------------------------------------------
-- Platform allowlists (must exist before handle_new_user)
-- -----------------------------------------------------------------------------
create table if not exists public.superadmins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.store_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Bootstrap profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_super boolean;
  is_admin boolean;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do update set email = excluded.email;

  select exists (
    select 1 from public.superadmins s where lower(s.email) = lower(new.email)
  ) into is_super;
  if is_super then
    update public.profiles set role = 'superadmin' where id = new.id;
  end if;

  select exists (
    select 1 from public.store_admins s where lower(s.email) = lower(new.email)
  ) into is_admin;
  if is_admin and not is_super then
    update public.profiles set role = 'admin' where id = new.id and role = 'customer';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

  -- -----------------------------------------------------------------------------
  -- Public-safe storefront row (no payment secrets)
  -- -----------------------------------------------------------------------------
  create table if not exists public.storefront_settings (
    id smallint primary key default 1 check (id = 1),
    store_name text not null default 'RonnyandMe',
    announcement_bar text,
    maintenance_mode boolean not null default false,
    whatsapp_number text,
    support_email text,
    currency_code text not null default 'GHS',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  insert into public.storefront_settings (id) values (1)
  on conflict (id) do nothing;

  -- Sensitive / full settings (admin + service role)
  create table if not exists public.site_settings (
    id smallint primary key default 1 check (id = 1),
    feature_flags jsonb not null default '{}'::jsonb,
    payment_providers jsonb not null default '{}'::jsonb,
    analytics jsonb not null default '{}'::jsonb,
    theme jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  insert into public.site_settings (id) values (1)
  on conflict (id) do nothing;

  -- -----------------------------------------------------------------------------
  -- Catalog
  -- -----------------------------------------------------------------------------
  create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    image_url text,
    sort_order int not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table if not exists public.collections (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    image_url text,
    collection_type text not null default 'manual' check (collection_type in ('manual', 'smart')),
    rules jsonb,
    sort_order int not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid references public.categories (id) on delete set null,
    name text not null,
    slug text not null unique,
    description text,
    short_description text,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    is_featured boolean not null default false,
    is_new_arrival boolean not null default false,
    is_best_seller boolean not null default false,
    badges text[] not null default '{}',
    rating_avg numeric(3,2) not null default 0,
    review_count int not null default 0,
    delivery_estimate text,
    seo_title text,
    seo_description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists products_category_idx on public.products (category_id);
  create index if not exists products_status_idx on public.products (status);

  create table if not exists public.product_images (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products (id) on delete cascade,
    storage_path text,
    url text,
    sort_order int not null default 0,
    alt text,
    created_at timestamptz not null default now()
  );

  create index if not exists product_images_product_idx on public.product_images (product_id);

  create table if not exists public.attributes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    display_type text not null default 'select' check (display_type in ('select', 'color')),
    sort_order int not null default 0
  );

  create table if not exists public.attribute_values (
    id uuid primary key default gen_random_uuid(),
    attribute_id uuid not null references public.attributes (id) on delete cascade,
    value text not null,
    sort_order int not null default 0,
    unique (attribute_id, value)
  );

  create table if not exists public.variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products (id) on delete cascade,
    sku text not null unique,
    price numeric(12,2) not null,
    compare_at_price numeric(12,2),
    stock_quantity int not null default 0,
    option_values jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists variants_product_idx on public.variants (product_id);

  create table if not exists public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    variant_id uuid not null references public.variants (id) on delete cascade,
    quantity_delta int not null,
    reason text not null,
    reference_type text,
    reference_id uuid,
    created_by uuid references public.profiles (id),
    created_at timestamptz not null default now()
  );

  create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id);

  create table if not exists public.collection_products (
    collection_id uuid not null references public.collections (id) on delete cascade,
    product_id uuid not null references public.products (id) on delete cascade,
    sort_order int not null default 0,
    primary key (collection_id, product_id)
  );

  -- -----------------------------------------------------------------------------
  -- Customers / addresses / wishlist / carts
  -- -----------------------------------------------------------------------------
  create table if not exists public.addresses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    label text,
    full_name text not null,
    phone text,
    line1 text not null,
    line2 text,
    city text not null,
    region text,
    country text not null default 'Ghana',
    postal_code text,
    is_default boolean not null default false,
    created_at timestamptz not null default now()
  );

  create index if not exists addresses_user_idx on public.addresses (user_id);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.variants (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists wishlists_user_product_no_variant
  on public.wishlists (user_id, product_id) where variant_id is null;
create unique index if not exists wishlists_user_product_variant
  on public.wishlists (user_id, product_id, variant_id) where variant_id is not null;

  create table if not exists public.carts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles (id) on delete cascade,
    session_id text,
    updated_at timestamptz not null default now(),
    constraint carts_owner check (
      (user_id is not null and session_id is null) or
      (user_id is null and session_id is not null)
    )
  );

  create index if not exists carts_user_idx on public.carts (user_id);
  create index if not exists carts_session_idx on public.carts (session_id);

  create table if not exists public.cart_items (
    id uuid primary key default gen_random_uuid(),
    cart_id uuid not null references public.carts (id) on delete cascade,
    variant_id uuid not null references public.variants (id) on delete cascade,
    quantity int not null default 1 check (quantity > 0),
    unique (cart_id, variant_id)
  );

  -- -----------------------------------------------------------------------------
  -- Discounts & orders
  -- -----------------------------------------------------------------------------
  create table if not exists public.discounts (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text,
    discount_type text not null check (discount_type in ('percent', 'fixed', 'free_shipping')),
    value numeric(12,2),
    min_spend numeric(12,2),
    max_uses int,
    uses_count int not null default 0,
    starts_at timestamptz,
    ends_at timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    user_id uuid references public.profiles (id) on delete set null,
    guest_email text,
    guest_phone text,
    status public.order_status not null default 'pending',
    subtotal numeric(12,2) not null default 0,
    discount_total numeric(12,2) not null default 0,
    shipping_total numeric(12,2) not null default 0,
    tax_total numeric(12,2) not null default 0,
    grand_total numeric(12,2) not null default 0,
    currency text not null default 'GHS',
    shipping_address jsonb,
    billing_address jsonb,
    notes text,
    discount_id uuid references public.discounts (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists orders_user_idx on public.orders (user_id);
  create index if not exists orders_number_idx on public.orders (order_number);

  create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    product_id uuid not null references public.products (id),
    variant_id uuid references public.variants (id),
    name_snapshot text not null,
    sku_snapshot text,
    unit_price numeric(12,2) not null,
    quantity int not null check (quantity > 0),
    line_total numeric(12,2) not null
  );

  create index if not exists order_items_order_idx on public.order_items (order_id);

  create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    provider text not null,
    provider_ref text,
    amount numeric(12,2) not null,
    currency text not null default 'GHS',
    status public.payment_status not null default 'pending',
    raw_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists payments_order_idx on public.payments (order_id);

  create table if not exists public.shipments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    carrier text,
    tracking_number text,
    status text not null default 'pending',
    shipped_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz not null default now()
  );

  create table if not exists public.returns (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    user_id uuid references public.profiles (id),
    reason text,
    status text not null default 'requested',
    created_at timestamptz not null default now()
  );

  -- -----------------------------------------------------------------------------
  -- Content & monitoring
  -- -----------------------------------------------------------------------------
  create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products (id) on delete cascade,
    user_id uuid references public.profiles (id) on delete set null,
    rating int not null check (rating between 1 and 5),
    title text,
    body text,
    is_verified_purchase boolean not null default false,
    is_published boolean not null default false,
    created_at timestamptz not null default now()
  );

  create index if not exists reviews_product_idx on public.reviews (product_id);

  create table if not exists public.blog_posts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    slug text not null unique,
    excerpt text,
    body text,
    cover_image_url text,
    category text,
    published boolean not null default false,
    published_at timestamptz,
    read_time_minutes int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.home_content (
    id smallint primary key default 1 check (id = 1),
    sections jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
  );

  insert into public.home_content (id, sections) values (1, '[]'::jsonb)
  on conflict (id) do nothing;

  create table if not exists public.webhook_logs (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    event_type text,
    payload jsonb,
    headers jsonb,
    status_code int,
    error text,
    created_at timestamptz not null default now()
  );

  create index if not exists webhook_logs_provider_idx on public.webhook_logs (provider);
  create index if not exists webhook_logs_created_idx on public.webhook_logs (created_at desc);

  create table if not exists public.login_audit_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles (id) on delete set null,
    email text,
    ip inet,
    user_agent text,
    success boolean not null default true,
    created_at timestamptz not null default now()
  );

  -- -----------------------------------------------------------------------------
  -- Helper: role checks (SECURITY DEFINER, fixed search_path)
  -- -----------------------------------------------------------------------------
  create or replace function public.profile_role()
  returns public.user_role
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select role from public.profiles where id = auth.uid();
  $$;

  create or replace function public.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff', 'admin', 'superadmin')
    );
  $$;

  create or replace function public.is_admin_or_above()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superadmin')
    );
  $$;

  create or replace function public.is_superadmin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'superadmin'
    );
  $$;

  -- -----------------------------------------------------------------------------
  -- RLS
  -- -----------------------------------------------------------------------------
  alter table public.profiles enable row level security;
  alter table public.superadmins enable row level security;
  alter table public.store_admins enable row level security;
  alter table public.storefront_settings enable row level security;
  alter table public.site_settings enable row level security;
  alter table public.categories enable row level security;
  alter table public.collections enable row level security;
  alter table public.products enable row level security;
  alter table public.product_images enable row level security;
  alter table public.attributes enable row level security;
  alter table public.attribute_values enable row level security;
  alter table public.variants enable row level security;
  alter table public.inventory_movements enable row level security;
  alter table public.collection_products enable row level security;
  alter table public.addresses enable row level security;
  alter table public.wishlists enable row level security;
  alter table public.carts enable row level security;
  alter table public.cart_items enable row level security;
  alter table public.discounts enable row level security;
  alter table public.orders enable row level security;
  alter table public.order_items enable row level security;
  alter table public.payments enable row level security;
  alter table public.shipments enable row level security;
  alter table public.returns enable row level security;
  alter table public.reviews enable row level security;
  alter table public.blog_posts enable row level security;
  alter table public.home_content enable row level security;
  alter table public.webhook_logs enable row level security;
  alter table public.login_audit_log enable row level security;

  -- Profiles
  create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
  create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
  create policy "profiles_staff_all" on public.profiles for all using (public.is_staff());

  -- Allowlists: superadmin only
  create policy "superadmins_super_only" on public.superadmins for all using (public.is_superadmin());
  create policy "store_admins_admin_plus" on public.store_admins for all using (public.is_admin_or_above());

  -- Storefront settings: public read, admin write
  create policy "storefront_read" on public.storefront_settings for select using (true);
  create policy "storefront_admin_write" on public.storefront_settings for all using (public.is_admin_or_above());

  -- Site settings: staff read (no anon), admin write
  create policy "site_settings_staff" on public.site_settings for select using (public.is_staff());
  create policy "site_settings_admin_write" on public.site_settings for all using (public.is_admin_or_above());

  -- Catalog: public read active
  create policy "categories_public_read" on public.categories for select using (is_active = true);
  create policy "categories_staff_all" on public.categories for all using (public.is_staff());

  create policy "collections_public_read" on public.collections for select using (is_active = true);
  create policy "collections_staff_all" on public.collections for all using (public.is_staff());

  create policy "products_public_read" on public.products for select using (status = 'active');
  create policy "products_staff_all" on public.products for all using (public.is_staff());

  create policy "product_images_public_read" on public.product_images for select
    using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
  create policy "product_images_staff_all" on public.product_images for all using (public.is_staff());

  create policy "attributes_public_read" on public.attributes for select using (true);
  create policy "attributes_staff_all" on public.attributes for all using (public.is_staff());

  create policy "attribute_values_public_read" on public.attribute_values for select using (true);
  create policy "attribute_values_staff_all" on public.attribute_values for all using (public.is_staff());

  create policy "variants_public_read" on public.variants for select
    using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
  create policy "variants_staff_all" on public.variants for all using (public.is_staff());

  create policy "inventory_staff" on public.inventory_movements for all using (public.is_staff());

  create policy "collection_products_public_read" on public.collection_products for select
    using (
      exists (select 1 from public.collections c where c.id = collection_id and c.is_active = true)
      and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    );
  create policy "collection_products_staff_all" on public.collection_products for all using (public.is_staff());

  -- Addresses / wishlist: own user
  create policy "addresses_own" on public.addresses for all using (user_id = auth.uid());
  create policy "addresses_staff" on public.addresses for all using (public.is_staff());

  create policy "wishlists_own" on public.wishlists for all using (user_id = auth.uid());
  create policy "wishlists_staff" on public.wishlists for all using (public.is_staff());

  -- Carts: by user or session (anon uses session_id — policies need session claim; simplified: user only for authenticated)
  create policy "carts_own_user" on public.carts for all using (user_id = auth.uid());
  create policy "carts_staff" on public.carts for all using (public.is_staff());

  create policy "cart_items_via_cart" on public.cart_items for all
    using (
      exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
    );
  create policy "cart_items_staff" on public.cart_items for all using (public.is_staff());

  -- Discounts: validate at checkout server-side; hide details from anon — staff manage, authenticated can read active codes optional
  create policy "discounts_staff_all" on public.discounts for all using (public.is_staff());

  -- Orders: own or staff
  create policy "orders_own" on public.orders for select using (user_id = auth.uid());
  create policy "orders_staff_all" on public.orders for all using (public.is_staff());

  create policy "order_items_own" on public.order_items for select
    using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
  create policy "order_items_staff_all" on public.order_items for all using (public.is_staff());

  create policy "payments_staff" on public.payments for all using (public.is_staff());

  create policy "shipments_own" on public.shipments for select
    using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
  create policy "shipments_staff_all" on public.shipments for all using (public.is_staff());

  create policy "returns_own" on public.returns for all using (user_id = auth.uid());
  create policy "returns_staff" on public.returns for all using (public.is_staff());

  -- Reviews: published public read; users insert own
  create policy "reviews_public_read" on public.reviews for select using (is_published = true);
  create policy "reviews_own_write" on public.reviews for insert with check (user_id = auth.uid());
  create policy "reviews_staff_all" on public.reviews for all using (public.is_staff());

  create policy "blog_public_read" on public.blog_posts for select using (published = true);
  create policy "blog_staff_all" on public.blog_posts for all using (public.is_staff());

  create policy "home_content_public_read" on public.home_content for select using (true);
  create policy "home_content_admin_write" on public.home_content for all using (public.is_admin_or_above());

  create policy "webhook_logs_super" on public.webhook_logs for all using (public.is_superadmin());

  create policy "login_audit_super" on public.login_audit_log for all using (public.is_superadmin());
  create policy "login_audit_own" on public.login_audit_log for select using (user_id = auth.uid());

  -- -----------------------------------------------------------------------------
  -- Storage buckets (policies applied in Dashboard or follow-up migration)
  -- -----------------------------------------------------------------------------
  insert into storage.buckets (id, name, public)
  values
    ('product-images', 'product-images', true),
    ('blog-covers', 'blog-covers', true),
    ('site-media', 'site-media', true),
    ('receipts', 'receipts', false)
  on conflict (id) do nothing;

  -- Public read for public buckets
  create policy "product_images_public_read"
    on storage.objects for select
    using (bucket_id = 'product-images');

  create policy "product_images_authenticated_upload"
    on storage.objects for insert
    with check (bucket_id = 'product-images' and auth.role() = 'authenticated' and public.is_staff());

  create policy "blog_covers_public_read"
    on storage.objects for select
    using (bucket_id = 'blog-covers');

  create policy "blog_covers_staff_upload"
    on storage.objects for insert
    with check (bucket_id = 'blog-covers' and public.is_staff());

  create policy "site_media_public_read"
    on storage.objects for select
    using (bucket_id = 'site-media');

  create policy "site_media_staff_upload"
    on storage.objects for insert
    with check (bucket_id = 'site-media' and public.is_staff());

  create policy "receipts_staff_only"
    on storage.objects for all
    using (bucket_id = 'receipts' and public.is_staff());
