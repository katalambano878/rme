/**
 * Plain-Postgres mode is active when a direct Postgres URL is configured.
 * Pair with NEXT_PUBLIC_USE_PLAIN_PG=true so Edge/middleware and the browser
 * SDK (self-hosted URL) stay aligned with the in-process data plane.
 */
export function isPlainPostgres(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export function authJwtSecret(): string {
  const secret =
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET;
  if (secret) return secret;
  // A known fallback would let anyone sign an admin token, so production
  // refuses to run auth without a real secret.
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET is not set; refusing to sign or verify sessions.");
  }
  return "dev-auth-secret-change-me";
}
