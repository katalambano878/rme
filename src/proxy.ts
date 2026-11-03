import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAccessToken } from "@/lib/db/auth"
import { query } from "@/lib/db/pool"

/**
 * Active proxy (src/), formerly middleware.ts: Next.js 16 renamed the
 * convention and runs it on the Node runtime, so it can query Postgres.
 *
 * Plain-PG mode: verify JWT from `sb-access-token` (admin login cookie).
 * Hosted Supabase fallback: service-role getUser + profiles.role.
 */

function usePlainPg(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_PLAIN_PG === "true" ||
    !!(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  )
}

/**
 * Pull an access token out of a supabase-js session cookie. @supabase/ssr
 * writes `base64-<json>` (sometimes split into `.0`, `.1` chunks); older
 * clients wrote raw JSON or a bare token.
 */
function tokenFromSessionCookie(raw: string): string | undefined {
  let text = raw
  if (text.startsWith("base64-")) {
    try {
      const b64 = text.slice(7).replace(/-/g, "+").replace(/_/g, "/")
      text = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
    } catch {
      return undefined
    }
  }
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0]
    if (parsed && typeof parsed === "object" && typeof parsed.access_token === "string")
      return parsed.access_token
    if (typeof parsed === "string") return parsed
  } catch {
    // A bare JWT
    if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(text)) return text
  }
  return undefined
}

/**
 * Every token the request carries, best first: the admin cookie, then the
 * supabase-js session cookie. A stale admin cookie must not hide a valid
 * session, so callers try each in turn.
 */
function extractTokens(request: NextRequest): string[] {
  const tokens: string[] = []
  const direct = request.cookies.get("sb-access-token")?.value
  if (direct) tokens.push(direct)

  // Session cookie may be chunked: sb-<ref>-auth-token.0, .1, ...
  const chunks = new Map<string, string[]>()
  for (const [name, cookie] of request.cookies) {
    const m = name.match(/^(sb-.+-auth-token)(?:\.(\d+))?$/)
    if (!m) continue
    const list = chunks.get(m[1]) ?? []
    list[Number(m[2] ?? 0)] = cookie.value
    chunks.set(m[1], list)
  }
  for (const parts of chunks.values()) {
    const token = tokenFromSessionCookie(parts.join(""))
    if (token && !tokens.includes(token)) tokens.push(token)
  }
  return tokens
}

/**
 * Admin gate for plain-PG mode. The role comes from `profiles`, not the token,
 * so demoted or deleted staff lose the admin screens at once instead of keeping
 * them until their 7-day token expires. Runs on the Node runtime (proxy.ts).
 */
async function verifyPlainPgAdmin(
  token: string,
): Promise<{ ok: boolean; userId?: string; role?: string }> {
  try {
    const verified = await verifyAccessToken(token)
    if (!verified) return { ok: false }
    const { rows } = await query<{ role: string | null }>(
      `SELECT role FROM profiles WHERE id = $1 LIMIT 1`,
      [verified.userId],
    )
    const role = rows[0]?.role ?? undefined
    if (role !== "admin" && role !== "staff" && role !== "superadmin") {
      return { ok: false }
    }
    return { ok: true, userId: verified.userId, role }
  } catch {
    return { ok: false }
  }
}

function redirectLogin(request: NextRequest, pathname: string, error?: string) {
  const loginUrl = new URL("/admin/login", request.url)
  loginUrl.searchParams.set("next", pathname)
  loginUrl.searchParams.set("redirect", pathname)
  if (error) loginUrl.searchParams.set("error", error)
  return NextResponse.redirect(loginUrl)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public payment / auth / storage shims — never gate these.
  if (
    pathname.startsWith("/api/payment/") ||
    pathname.startsWith("/auth/v1/") ||
    pathname.startsWith("/rest/v1/") ||
    pathname.startsWith("/storage/v1/") ||
    pathname === "/api/service-worker"
  ) {
    return NextResponse.next()
  }

  // Only protect admin surfaces here. Storefront + most APIs authenticate
  // themselves; running getUser() on every request caused latency/freezes.
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/superadmin")) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  if (pathname === "/admin/login") {
    return response
  }

  const tokens = extractTokens(request)
  if (tokens.length === 0) {
    return redirectLogin(request, pathname)
  }
  const token = tokens[0]

  if (usePlainPg()) {
    let verified: Awaited<ReturnType<typeof verifyPlainPgAdmin>> = { ok: false }
    for (const candidate of tokens) {
      verified = await verifyPlainPgAdmin(candidate)
      if (verified.ok) break
    }
    if (!verified.ok) {
      return redirectLogin(request, pathname, "session_expired")
    }
    if (pathname.startsWith("/superadmin") && verified.role !== "superadmin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    if (verified.userId) response.headers.set("x-user-id", verified.userId)
    if (verified.role) response.headers.set("x-user-role", verified.role)
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return redirectLogin(request, pathname, "session_expired")
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return redirectLogin(request, pathname, "session_expired")
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = profile?.role
    if (pathname.startsWith("/superadmin") && role !== "superadmin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    if (!role || !["admin", "superadmin", "staff"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    response.headers.set("x-user-id", user.id)
    response.headers.set("x-user-role", role)
    return response
  } catch {
    return redirectLogin(request, pathname, "session_expired")
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/superadmin/:path*",
    "/api/payment/:path*",
    "/auth/v1/:path*",
    "/rest/v1/:path*",
    "/storage/v1/:path*",
    "/api/service-worker",
  ],
}
