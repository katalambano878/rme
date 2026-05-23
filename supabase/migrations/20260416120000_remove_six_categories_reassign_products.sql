-- Remove Body Lotions, Body Wash, Lipglosses, Lip Scrub, Skincare, Skincare Sets.
-- Reassign products: body care → hair-products; lip + skincare groups → makeup.

update public.categories
set parent_id = null
where parent_id in (
  select id from public.categories
  where slug in (
    'body-lotions',
    'body-wash',
    'lipglosses',
    'lip-scrub',
    'skincare',
    'skincare-sets'
  )
);

update public.products p
set category_id = hp.id
from public.categories hp
where hp.slug = 'hair-products'
  and p.category_id in (
    select id from public.categories where slug in ('body-lotions', 'body-wash')
  );

update public.products p
set category_id = m.id
from public.categories m
where m.slug = 'makeup'
  and p.category_id in (
    select id from public.categories where slug in ('lipglosses', 'lip-scrub', 'skincare', 'skincare-sets')
  );

delete from public.categories
where slug in (
  'body-lotions',
  'body-wash',
  'lipglosses',
  'lip-scrub',
  'skincare',
  'skincare-sets'
);
