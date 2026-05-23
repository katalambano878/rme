# Supabase

1. Create a Supabase project and note the project URL and keys.
2. Paste the full contents of `migrations/20250324180000_init_store.sql` and run it once.
3. Apply later migrations in timestamp order (`migrations/*.sql`).
4. Optionally run `seed.sql` for demo data.

## Admin access

After auth is configured, allowlist admin emails:

```sql
insert into public.superadmins (email) values ('you@yourdomain.com')
  on conflict (email) do nothing;

insert into public.store_admins (email) values ('hello@ronnyandme.com')
  on conflict (email) do nothing;
```

Replace the emails with real addresses before production use.
