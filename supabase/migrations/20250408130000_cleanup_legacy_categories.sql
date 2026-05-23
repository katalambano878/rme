-- Sync catalog to the 14 canonical categories, then remove anything else.
-- Products linked to deleted categories get category_id = null (FK).

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
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

delete from public.categories
where lower(trim(slug)) not in (
  'dresses',
  'two-piece',
  'tops',
  'jeans',
  'bags',
  'watches',
  'perfumes',
  'sunglasses',
  'shoes',
  'heels',
  'slippers',
  'jewelries',
  'luggage',
  'men'
);
