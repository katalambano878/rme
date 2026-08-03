-- Product/variant sale_price used by storefront pricing + admin forms.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price numeric(12, 2);
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS sale_price numeric(12, 2);
