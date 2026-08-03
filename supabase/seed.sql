-- Optional seed (run after migration, as postgres or service role in SQL Editor)
-- Neutral starter categories for Trust Ecom (customize in admin)

insert into public.categories (name, slug, description, sort_order, is_active)
values
  ('Featured', 'featured', 'Featured products', 1, true),
  ('New Arrivals', 'new-arrivals', 'Latest products', 2, true),
  ('Best Sellers', 'best-sellers', 'Customer favorites', 3, true),
  ('Sale', 'sale', 'Deals and discounts', 4, true)
on conflict (slug) do nothing;

update public.storefront_settings set
  announcement_bar = 'Free delivery on qualifying orders · Easy returns · Shop with confidence',
  store_name = 'Trust Ecom',
  whatsapp_number = '',
  support_email = 'hello@trustecom.com'
where id = 1;

update public.site_settings set
  feature_flags = jsonb_build_object(
    'reviews', true,
    'loyalty', false,
    'referrals', false,
    'bundles', false,
    'abandoned_cart', false,
    'store_credit', false,
    'subscriptions', false,
    'staff_chat', false,
    'advanced_analytics', false,
    'instagram_shop', false
  ),
  payment_providers = jsonb_build_object(
    'moolre', jsonb_build_object('enabled', true),
    'paystack', jsonb_build_object('enabled', false)
  )
where id = 1;
