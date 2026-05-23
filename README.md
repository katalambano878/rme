# Storefront

Next.js commerce storefront with admin tools. Configure environment variables from `.env.example`, connect Supabase, and run locally.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run create-admin` — helper for admin user setup (see `scripts/create-admin-user.mjs`)

See `supabase/README.md` for database migration notes.
