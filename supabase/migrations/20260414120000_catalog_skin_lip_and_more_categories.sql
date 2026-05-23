-- Skin care & Lip care parents + subcategories; new top-level categories (Jewelries may already exist from earlier seed).

insert into public.categories (name, slug, description, sort_order, is_active)
values
  ('Skin care', 'skin-care', 'Skincare products', 100, true),
  ('Lip care', 'lip-care', 'Lip care products', 101, true),
  ('Scents', 'scents', 'Fragrances and scents', 102, true),
  ('Household items', 'household-items', 'Home essentials', 103, true),
  ('Fabrics', 'fabrics', 'Fabric and textiles', 104, true),
  ('RÉMORA', 'remora', 'RÉMORA collection', 105, true),
  ('Hair and wig bundle', 'hair-and-wig-bundle', 'Hair and wigs', 106, true),
  ('Bags and slippers', 'bags-and-slippers', 'Bags and slippers', 107, true)
on conflict (slug) do nothing;

-- Subcategories (parent_id requires featured_on_home migration columns — parent_id only)
insert into public.categories (name, slug, description, sort_order, is_active, parent_id)
select 'Skin care set', 'skin-care-set', 'Skincare sets', 1, true, id
from public.categories where slug = 'skin-care' limit 1
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, sort_order, is_active, parent_id)
select 'Body lotion', 'skin-care-body-lotion', 'Body lotion', 2, true, id
from public.categories where slug = 'skin-care' limit 1
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, sort_order, is_active, parent_id)
select 'Body wash', 'skin-care-body-wash', 'Body wash', 3, true, id
from public.categories where slug = 'skin-care' limit 1
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, sort_order, is_active, parent_id)
select 'Lip glosses', 'lip-care-lip-glosses', 'Lip glosses', 1, true, id
from public.categories where slug = 'lip-care' limit 1
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, sort_order, is_active, parent_id)
select 'Lip scrub', 'lip-care-lip-scrub', 'Lip scrub', 2, true, id
from public.categories where slug = 'lip-care' limit 1
on conflict (slug) do nothing;
