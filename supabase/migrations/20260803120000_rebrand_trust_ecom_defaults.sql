-- Trust Ecom: update storefront_settings defaults for fresh installs and existing row.
-- Historical migration 20250324180000 kept as-is; this forward migration replaces brand defaults.

alter table public.storefront_settings
  alter column store_name set default 'Trust Ecom';

update public.storefront_settings
set
  store_name = 'Trust Ecom',
  whatsapp_number = coalesce(nullif(trim(whatsapp_number), ''), ''),
  support_email = 'hello@trustecom.com'
where id = 1
   or store_name in ('RonnyandMe', 'Ronny & Mimi''s Essentials');
