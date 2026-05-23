-- Optional seed (run after migration, as postgres or service role in SQL Editor)
-- Default catalog categories (mirrors src/lib/catalog-default-categories.ts)

insert into public.categories (name, slug, description, sort_order, is_active)
values
  ('Dresses', 'dresses', 'Dresses for every occasion', 1, true),
  ('Two piece', 'two-piece', 'Coordinated two-piece sets', 2, true),
  ('Tops', 'tops', 'Blouses, shirts, and tops', 3, true),
  ('Jeans', 'jeans', 'Denim fits you will love', 4, true),
  ('Bags', 'bags', 'Handbags and everyday bags', 5, true),
  ('Watches', 'watches', 'Timepieces and wristwear', 6, true),
  ('Perfumes', 'perfumes', 'Fragrances and scents', 7, true),
  ('Sunglasses', 'sunglasses', 'Eyewear and sun protection', 8, true),
  ('Shoes', 'shoes', 'Footwear for every look', 9, true),
  ('Heels', 'heels', 'Heels and elevated styles', 10, true),
  ('Slippers', 'slippers', 'Comfortable slip-ons', 11, true),
  ('Jewelries', 'jewelries', 'Jewelry and accessories', 12, true),
  ('Luggage', 'luggage', 'Travel bags and luggage', 13, true),
  ('Men', 'men', 'Men''s collection', 14, true)
on conflict (slug) do nothing;

update public.storefront_settings set
  announcement_bar = 'Free delivery on orders over GH₵ 2,000 · Authentic products · Easy returns',
  store_name = 'RonnyandMe',
  whatsapp_number = '+233592707791',
  support_email = 'hello@ronnyandme.com'
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
