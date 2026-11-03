import { NextRequest, NextResponse } from "next/server";
import {
  signInWithPassword,
  signUpWithPassword,
  refreshSession,
  verifyAccessToken,
  getUserById,
  updateUserPassword,
  revokeSessions,
  createPasswordReset,
  resetPasswordWithToken,
  updateUserMetadata,
} from "@/lib/db/auth";
import { isPlainPostgres } from "@/lib/db/mode";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { sendPasswordReset, storeBaseUrl } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}

function gotrueError(message: string, status = 400, code = "invalid_request") {
  return NextResponse.json(
    { error: code, error_description: message, msg: message, message },
    { status, headers: cors() }
  );
}

function tooManyAttempts(resetIn: number) {
  const res = gotrueError(
    "Too many attempts. Please wait a few minutes and try again.",
    429,
    "over_request_rate_limit",
  );
  res.headers.set("Retry-After", String(resetIn));
  return res;
}

function sessionResponse(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: unknown;
}) {
  return NextResponse.json(
    {
      access_token: session.access_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: session.user,
    },
    { status: 200, headers: cors() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  if (!isPlainPostgres()) return gotrueError("DATABASE_URL not set", 503);

  const { path } = await ctx.params;
  const slug = path.join("/");

  if (slug === "user") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return gotrueError("No authorization header", 401, "no_authorization");
    const verified = await verifyAccessToken(token);
    if (!verified) return gotrueError("Invalid JWT", 401, "invalid_token");
    const user = await getUserById(verified.userId);
    if (!user) return gotrueError("User not found", 401, "user_not_found");
    return NextResponse.json(user, { headers: cors() });
  }

  if (slug === "settings" || slug === "health") {
    return NextResponse.json({ external: {}, disable_signup: false }, { headers: cors() });
  }

  return gotrueError(`Unknown auth path: ${slug}`, 404);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  if (!isPlainPostgres()) return gotrueError("DATABASE_URL not set", 503);

  const { path } = await ctx.params;
  const slug = path.join("/");
  const url = req.nextUrl;
  const contentType = req.headers.get("content-type") || "";

  let body: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  // /auth/v1/token?grant_type=password|refresh_token
  if (slug === "token") {
    const grant =
      url.searchParams.get("grant_type") ||
      body.grant_type ||
      "password";

    if (grant === "password") {
      const email = String(body.email || "");
      const password = String(body.password || "");
      const ip = getClientIdentifier(req);
      const byIp = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
      const byEmail = checkRateLimit(
        `login-email:${email.trim().toLowerCase()}`,
        RATE_LIMITS.loginEmail,
      );
      if (!byIp.success || !byEmail.success) {
        return tooManyAttempts(Math.max(byIp.resetIn, byEmail.resetIn));
      }
      const { session, error } = await signInWithPassword(email, password);
      if (error || !session) {
        return gotrueError(error || "Invalid login credentials", 400, "invalid_grant");
      }
      return sessionResponse(session);
    }

    if (grant === "refresh_token") {
      const refresh = String(body.refresh_token || "");
      const { session, error } = await refreshSession(refresh);
      if (error || !session) {
        return gotrueError(error || "Invalid refresh token", 400, "invalid_grant");
      }
      return sessionResponse(session);
    }

    return gotrueError(`Unsupported grant_type: ${grant}`);
  }

  if (slug === "signup") {
    const limited = checkRateLimit(`signup:${getClientIdentifier(req)}`, RATE_LIMITS.signup);
    if (!limited.success) return tooManyAttempts(limited.resetIn);
    const { session, error } = await signUpWithPassword({
      email: String(body.email || ""),
      password: String(body.password || ""),
      data: userMetadataFrom(body),
    });
    if (error || !session) {
      return gotrueError(error || "Signup failed", 400);
    }
    return sessionResponse(session);
  }

  if (slug === "logout") {
    // Ends the session on the server too, not just in the browser.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return gotrueError("No authorization header", 401, "no_authorization");
    const scope = req.nextUrl.searchParams.get("scope") || "global";
    if (scope !== "global" && scope !== "local") {
      return gotrueError("Unsupported logout scope", 400);
    }
    const { error } = await revokeSessions(token, scope);
    if (error) return gotrueError(error, 401, "invalid_token");
    return new NextResponse(null, { status: 204, headers: cors() });
  }

  if (slug === "recover") {
    // Always the same reply, so the form can't be used to find out who has an account.
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const ipLimit = checkRateLimit(`reset:${getClientIdentifier(req)}`, RATE_LIMITS.passwordReset);
    if (!ipLimit.success) return tooManyAttempts(ipLimit.resetIn);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const emailLimit = checkRateLimit(`reset-email:${email}`, RATE_LIMITS.passwordResetEmail);
      if (emailLimit.success) {
        const reset = await createPasswordReset(email).catch((err) => {
          console.error("[auth] reset token failed:", err instanceof Error ? err.message : err);
          return null;
        });
        if (reset) {
          const resetUrl = `${storeBaseUrl()}/auth/reset-password?token=${encodeURIComponent(reset.token)}`;
          await sendPasswordReset({ ...reset, resetUrl }).catch((err) =>
            console.error("[auth] reset message failed:", err instanceof Error ? err.message : err)
          );
        }
      }
    }
    return NextResponse.json({}, { status: 200, headers: cors() });
  }

  if (slug === "reset") {
    const limited = checkRateLimit(`reset-use:${getClientIdentifier(req)}`, RATE_LIMITS.login);
    if (!limited.success) return tooManyAttempts(limited.resetIn);
    const { error } = await resetPasswordWithToken(String(body.token || ""), String(body.password || ""));
    if (error) return gotrueError(error, 400);
    return NextResponse.json({}, { status: 200, headers: cors() });
  }

  return gotrueError(`Unknown auth path: ${slug}`, 404);
}

/** Only the profile fields the app uses; anything else a client sends is dropped. */
const USER_METADATA_KEYS = ["full_name", "phone", "avatar_url"] as const;

function userMetadataFrom(body: Record<string, unknown>): Record<string, string> {
  const raw = body.data || body.user_metadata;
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const fields = raw as Record<string, unknown>;
  for (const key of USER_METADATA_KEYS) {
    const value = fields[key];
    if (typeof value === "string") out[key] = value.trim().slice(0, 200);
  }
  return out;
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  if (!isPlainPostgres()) return gotrueError("DATABASE_URL not set", 503);

  const { path } = await ctx.params;
  const slug = path.join("/");

  if (slug !== "user") {
    return gotrueError(`Unknown auth path: ${slug}`, 404);
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return gotrueError("No authorization header", 401, "no_authorization");
  const verified = await verifyAccessToken(token);
  if (!verified) return gotrueError("Invalid JWT", 401, "invalid_token");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.password) {
    // Changing the password signs out every other session (see passwordVersion).
    const { user, error } = await updateUserPassword(
      verified.userId,
      String(body.password),
      String(body.current_password ?? "")
    );
    if (error || !user) return gotrueError(error || "Update failed");
    return NextResponse.json(user, { headers: cors() });
  }

  if (body.data || body.user_metadata) {
    const { user, error } = await updateUserMetadata(verified.userId, userMetadataFrom(body));
    if (error || !user) return gotrueError(error || "Update failed");
    return NextResponse.json(user, { headers: cors() });
  }

  const user = await getUserById(verified.userId);
  return NextResponse.json(user, { headers: cors() });
}
