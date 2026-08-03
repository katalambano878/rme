# Trust Ecom

Next.js ecommerce storefront with admin tools. Configure environment variables from `.env.example`, connect Supabase, and run locally.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in Supabase, payment, and email keys — never commit real secrets
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Brand identity (name, domain, contact, socials) lives in `src/lib/brand.ts`. Update that file before launch.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run create-admin` — helper for admin user setup (see `scripts/create-admin-user.mjs`)

See `supabase/README.md` for database migration notes.

## Existing databases

If you already applied older migrations that defaulted `store_name` to a previous brand, run the forward migration `supabase/migrations/20260803120000_rebrand_trust_ecom_defaults.sql` (or update `storefront_settings` manually).
