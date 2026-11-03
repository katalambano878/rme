// GoTrue-compatible auth against plain Postgres auth.users (bcrypt hashes).

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "crypto";
import { query } from "./pool";
import { authJwtSecret } from "./mode";

const ACCESS_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export interface AuthUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  phone: string;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: unknown[];
  created_at: string;
  updated_at: string;
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: AuthUser;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(authJwtSecret());
}

/** An auth.users row as the queries below select it. */
interface UserRow {
  id: string;
  email?: string | null;
  phone?: string | null;
  encrypted_password?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  raw_app_meta_data?: unknown;
  raw_user_meta_data?: unknown;
  created_at: string;
  updated_at?: string | null;
}

/** jsonb metadata may arrive parsed or as text. */
function metadataObject(value: unknown): Record<string, unknown> {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value || "{}") : value;
  return parsed && typeof parsed === "object" ? { ...(parsed as Record<string, unknown>) } : {};
}

function rowToUser(row: UserRow, appRole?: string | null): AuthUser {
  const meta = metadataObject(row.raw_user_meta_data);
  const appMeta = metadataObject(row.raw_app_meta_data);
  if (appRole) {
    appMeta.role = appRole;
  }
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email || "",
    phone: row.phone || "",
    email_confirmed_at: row.email_confirmed_at || null,
    phone_confirmed_at: row.phone_confirmed_at || null,
    confirmed_at: row.email_confirmed_at || row.phone_confirmed_at || null,
    last_sign_in_at: row.last_sign_in_at || null,
    app_metadata: appMeta,
    user_metadata: meta,
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

async function loadAppRole(userId: string): Promise<string | null> {
  try {
    const { rows } = await query<{ role: string }>(
      `SELECT role FROM profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Short fingerprint of the stored password hash. Every token carries it, so a
 * password change (or reset) invalidates every session issued before it.
 */
function passwordVersion(encryptedPassword: unknown): string {
  return createHash("sha256").update(String(encryptedPassword || "")).digest("hex").slice(0, 16);
}

/**
 * Server-side sign-out. `global` logout stores a per-user cut-off (every token
 * issued at or before it dies); `local` logout revokes one session_id. The
 * table is created on first use so a missed migration can't break logins.
 */
let revocationTableReady: Promise<boolean> | null = null;

function ensureRevocationTable(): Promise<boolean> {
  revocationTableReady ??= query(
    `CREATE TABLE IF NOT EXISTS public.auth_session_revocations (
       id bigserial PRIMARY KEY,
       user_id uuid NOT NULL,
       session_id uuid,
       revoked_at timestamptz NOT NULL DEFAULT now(),
       expires_at timestamptz NOT NULL
     );
     CREATE INDEX IF NOT EXISTS auth_session_revocations_user_idx
       ON public.auth_session_revocations (user_id);`
  )
    .then(() => true)
    .catch((err) => {
      console.error("[auth] session revocation table unavailable:", err instanceof Error ? err.message : err);
      revocationTableReady = null;
      return false;
    });
  return revocationTableReady;
}

/**
 * The user still exists, isn't deleted, hasn't changed password since `pwv`
 * was issued, and hasn't signed this session out.
 */
async function tokenStillValid(
  userId: string,
  pwv: unknown,
  sessionId: unknown,
  issuedAt: unknown,
): Promise<boolean> {
  const { rows } = await query<{ encrypted_password: string | null }>(
    `SELECT encrypted_password FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as { encrypted_password: string | null }[], rowCount: 0 }));
  if (!rows[0]) return false;
  if (typeof pwv !== "string" || pwv !== passwordVersion(rows[0].encrypted_password)) return false;

  if (!(await ensureRevocationTable())) return true;
  const iat = typeof issuedAt === "number" ? issuedAt : 0;
  const revoked = await query<{ hit: number }>(
    `SELECT 1 AS hit FROM public.auth_session_revocations
      WHERE user_id = $1
        AND ((session_id IS NULL AND $3::numeric <= extract(epoch FROM revoked_at))
          OR session_id = $2::uuid)
      LIMIT 1`,
    [userId, typeof sessionId === "string" ? sessionId : null, iat]
  ).catch(() => ({ rows: [] as { hit: number }[], rowCount: 0 }));
  return revoked.rows.length === 0;
}

/** Revoke one session (`local`) or every session issued so far (`global`). */
export async function revokeSessions(
  token: string,
  scope: "global" | "local"
): Promise<{ error: string | null }> {
  const verified = await verifyAccessToken(token);
  if (!verified) return { error: "Invalid JWT" };
  if (!(await ensureRevocationTable())) return { error: "Sign-out is unavailable right now" };
  const sessionId = typeof verified.payload.session_id === "string" ? verified.payload.session_id : null;
  if (scope === "local" && !sessionId) return { error: "Session has no id" };
  // Rows only matter until the longest-lived token they could match expires.
  await query(
    `INSERT INTO public.auth_session_revocations (user_id, session_id, expires_at)
     VALUES ($1, $2, now() + interval '${REFRESH_TTL_SEC} seconds')`,
    [verified.userId, scope === "local" ? sessionId : null]
  );
  await query(`DELETE FROM public.auth_session_revocations WHERE expires_at < now()`).catch(() => {});
  return { error: null };
}

async function mintSession(userRow: UserRow): Promise<SessionTokens> {
  const appRole = await loadAppRole(userRow.id);
  const user = rowToUser(userRow, appRole);
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const pwv = passwordVersion(userRow.encrypted_password);

  const access_token = await new SignJWT({
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    phone: user.phone,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    session_id: sessionId,
    pwv,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SEC)
    .sign(secretKey());

  const refresh_token = await new SignJWT({
    typ: "refresh",
    session_id: sessionId,
    pwv,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SEC)
    .sign(secretKey());

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TTL_SEC,
    expires_at: now + ACCESS_TTL_SEC,
    token_type: "bearer",
    user,
  };
}

export async function verifyAccessToken(
  token: string
): Promise<{ userId: string; payload: Record<string, unknown> } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ === "refresh") return null;
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;
    if (!(await tokenStillValid(userId, payload.pwv, payload.session_id, payload.iat))) return null;
    return { userId, payload: payload as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, phone, encrypted_password, email_confirmed_at,
            phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
            raw_user_meta_data, created_at, updated_at
     FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  const appRole = await loadAppRole(userId);
  return rowToUser(rows[0], appRole);
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ session: SessionTokens | null; error: string | null }> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await query<UserRow>(
    `SELECT id, email, phone, encrypted_password, email_confirmed_at,
            phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
            raw_user_meta_data, created_at, updated_at
     FROM auth.users
     WHERE lower(email) = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row?.encrypted_password) {
    return { session: null, error: "Invalid login credentials" };
  }
  const ok = bcrypt.compareSync(password, row.encrypted_password);
  if (!ok) {
    return { session: null, error: "Invalid login credentials" };
  }

  await query(
    `UPDATE auth.users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1`,
    [row.id]
  ).catch(() => {});

  const session = await mintSession(row);
  return { session, error: null };
}

export async function signUpWithPassword(opts: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
}): Promise<{ session: SessionTokens | null; user: AuthUser | null; error: string | null }> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !opts.password || opts.password.length < 6) {
    return { session: null, user: null, error: "Email and password (min 6 chars) required" };
  }

  const existing = await query(`SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1`, [
    email,
  ]);
  if (existing.rows[0]) {
    return { session: null, user: null, error: "User already registered" };
  }

  const id = randomUUID();
  const hash = bcrypt.hashSync(opts.password, 10);
  const meta = opts.data || {};

  await query(
    `INSERT INTO auth.users (
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
       created_at, updated_at, confirmation_token, recovery_token,
       email_change_token_new, email_change
     ) VALUES (
       $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, $3, now(), '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb,
       now(), now(), '', '', '', ''
     )`,
    [id, email, hash, JSON.stringify(meta)]
  );

  // Ensure profile row exists (app expects profiles.id = auth.users.id)
  await query(
    `INSERT INTO profiles (id, email, full_name, role, permissions, created_at, updated_at)
     VALUES ($1, $2, $3, 'customer', '{}'::jsonb, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [id, email, String(meta.full_name || "").slice(0, 120) || email.split("@")[0]]
  ).catch((err) => {
    console.error("[auth] signup profile insert failed:", err instanceof Error ? err.message : err);
  });

  const { rows } = await query<UserRow>(`SELECT * FROM auth.users WHERE id = $1`, [id]);
  const session = await mintSession(rows[0]);
  return { session, user: session.user, error: null };
}

export async function refreshSession(
  refreshToken: string
): Promise<{ session: SessionTokens | null; error: string | null }> {
  try {
    const { payload } = await jwtVerify(refreshToken, secretKey());
    if (payload.typ !== "refresh") {
      return { session: null, error: "Invalid refresh token" };
    }
    const userId = payload.sub;
    if (!userId || typeof userId !== "string") {
      return { session: null, error: "Invalid refresh token" };
    }
    if (!(await tokenStillValid(userId, payload.pwv, payload.session_id, payload.iat))) {
      return { session: null, error: "Invalid refresh token" };
    }
    const { rows } = await query<UserRow>(
      `SELECT id, email, phone, encrypted_password, email_confirmed_at,
              phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
              raw_user_meta_data, created_at, updated_at
       FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return { session: null, error: "User not found" };
    const session = await mintSession(rows[0]);
    return { session, error: null };
  } catch {
    return { session: null, error: "Invalid refresh token" };
  }
}

export async function updateUserPassword(
  userId: string,
  password: string,
  currentPassword?: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!password || password.length < 6) {
    return { user: null, error: "Password must be at least 6 characters" };
  }
  // A stolen session alone must not be enough to lock the owner out.
  if (currentPassword !== undefined) {
    const { rows } = await query<{ encrypted_password: string | null }>(
      `SELECT encrypted_password FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    const hash = rows[0]?.encrypted_password;
    if (!hash || !bcrypt.compareSync(currentPassword, hash)) {
      return { user: null, error: "Current password is incorrect" };
    }
  }
  const hash = bcrypt.hashSync(password, 10);
  await query(
    `UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`,
    [hash, userId]
  );
  const user = await getUserById(userId);
  return { user, error: null };
}

/** Admin: create a confirmed user (replaces supabase.auth.admin.createUser). */
export async function adminCreateUser(opts: {
  email: string;
  password: string;
  emailConfirm?: boolean;
  userMetadata?: Record<string, unknown>;
}): Promise<{ user: AuthUser | null; error: string | null }> {
  const result = await signUpWithPassword({
    email: opts.email,
    password: opts.password,
    data: opts.userMetadata,
  });
  if (result.error || !result.user) {
    return { user: null, error: result.error || "Could not create user" };
  }
  return { user: result.user, error: null };
}

/** Admin: soft-delete a user (replaces supabase.auth.admin.deleteUser). */
export async function adminDeleteUser(
  userId: string
): Promise<{ error: string | null }> {
  if (!userId) return { error: "userId required" };
  try {
    await query(
      `UPDATE auth.users SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Delete failed" };
  }
}

export async function updateUserMetadata(
  userId: string,
  data: Record<string, unknown>
): Promise<{ user: AuthUser | null; error: string | null }> {
  await query(
    `UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $1::jsonb,
         updated_at = now()
     WHERE id = $2`,
    [JSON.stringify(data), userId]
  );
  if (typeof data.full_name === "string" || typeof data.phone === "string") {
    await query(
      `UPDATE profiles SET
         full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         updated_at = now()
       WHERE id = $3`,
      [
        typeof data.full_name === "string" ? data.full_name : null,
        typeof data.phone === "string" ? data.phone : null,
        userId,
      ]
    ).catch(() => {});
  }
  const user = await getUserById(userId);
  return { user, error: null };
}

// ─── Forgot password ──────────────────────────────────────────────────────────

const RESET_TTL_MIN = 30;

let resetTableReady: Promise<boolean> | null = null;

function ensureResetTable(): Promise<boolean> {
  resetTableReady ??= query(
    `CREATE TABLE IF NOT EXISTS public.auth_password_resets (
       token_hash text PRIMARY KEY,
       user_id uuid NOT NULL,
       created_at timestamptz NOT NULL DEFAULT now(),
       expires_at timestamptz NOT NULL,
       used_at timestamptz
     );
     CREATE INDEX IF NOT EXISTS auth_password_resets_user_idx
       ON public.auth_password_resets (user_id);`
  )
    .then(() => true)
    .catch((err) => {
      console.error("[auth] password reset table unavailable:", err instanceof Error ? err.message : err);
      resetTableReady = null;
      return false;
    });
  return resetTableReady;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a single-use reset token for an account. Returns null when no live
 * account has that email (callers must not reveal which). Only the token's
 * hash is stored; any older unused token for the user stops working.
 */
export async function createPasswordReset(email: string): Promise<{
  token: string;
  email: string;
  phone: string | null;
  name: string | null;
} | null> {
  const clean = email.trim().toLowerCase();
  if (!clean || !(await ensureResetTable())) return null;
  const { rows } = await query<{ id: string; email: string; phone: string | null; full_name: string | null }>(
    `SELECT u.id, u.email, coalesce(p.phone, u.phone) AS phone, p.full_name
       FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
      WHERE lower(u.email) = $1 AND u.deleted_at IS NULL
      LIMIT 1`,
    [clean]
  );
  const user = rows[0];
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  await query(`UPDATE public.auth_password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
  await query(
    `INSERT INTO public.auth_password_resets (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '${RESET_TTL_MIN} minutes')`,
    [hashResetToken(token), user.id]
  );
  await query(`DELETE FROM public.auth_password_resets WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  return { token, email: user.email, phone: user.phone || null, name: user.full_name || null };
}

/** Set a new password from a reset link. Signs out every existing session. */
export async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ error: string | null }> {
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };
  if (!token || !(await ensureResetTable())) return { error: "This reset link is invalid or has expired" };
  // Claim the token atomically so it can only be used once.
  const { rows } = await query<{ user_id: string }>(
    `UPDATE public.auth_password_resets SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [hashResetToken(token)]
  );
  const userId = rows[0]?.user_id;
  if (!userId) return { error: "This reset link is invalid or has expired" };
  // No current password here: holding the emailed link proves ownership.
  const { error } = await updateUserPassword(userId, password);
  return { error };
}
