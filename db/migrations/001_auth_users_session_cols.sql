-- Extend auth.users for plain-Postgres session auth (JWT cookies).
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

ALTER TABLE auth.users
  ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique
  ON auth.users (lower(email));
