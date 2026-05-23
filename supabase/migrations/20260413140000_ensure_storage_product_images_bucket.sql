-- Ensure public bucket exists (admin uploads use this id; was incorrectly referenced as "products" in app code)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;
