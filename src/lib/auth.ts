/**
 * Re-export plain-Postgres auth (JWT cookie + auth.users).
 * Replaces the former Supabase Auth helpers.
 */
export {
  authenticateWithPassword,
  registerUser,
  sessionTokenForUser,
  attachSession,
  detachSession,
  verifyAuth,
  requireAdmin,
  verifyAdminToken,
  getSessionFromRequest,
  getSessionFromCookies,
  isStaffRole,
  type AuthUser,
  type AuthResult,
  type SessionPayload,
} from "./auth/index"
