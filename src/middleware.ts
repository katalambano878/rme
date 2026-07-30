import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { jwtVerify } from "jose"

/**
 * Active middleware (src/). Root middleware.ts is intentionally removed —
 * Next.js with a `src/` app uses this file.
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

function extractToken(request: NextRequest): string | undefined {
  let token = request.cookies.get("sb-access-token")?.value

  if (!token) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const projectRef = supabaseUrl.split("//")[1]?.split(".")[0]
    if (projectRef) {
      const raw = request.cookies.get(`sb-${projectRef}-auth-token`)?.value
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed[0]) token = parsed[0]
          else if (typeof parsed === "object" && parsed?.access_token)
            token = parsed.access_token
          else if (typeof parsed === "string") token = parsed
        } catch {
          token = raw
        }
      }
    }
  }

  if (!token) {
    for (const [name, cookie] of request.cookies) {
      if (
        name.startsWith("sb-") &&
        (name.endsWith("-auth-token") || name.includes("auth"))
      ) {
        try {
          const parsed = JSON.parse(cookie.value)
          if (Array.isArray(parsed) && parsed[0]) token = parsed[0]
          else if (typeof parsed === "object" && parsed?.access_token)
            token = parsed.access_token
          else if (typeof parsed === "string") token = parsed
        } catch {
          token = cookie.value
        }
        if (token) break
      }
    }
  }

  return token
}

async function verifyPlainPgAdmin(
  token: string,
): Promise<{ ok: boolean; userId?: string; role?: string }> {
  const secret =
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET
  if (!secret) return { ok: false }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    )
    if (payload.typ === "refresh") return { ok: false }
    const userId = typeof payload.sub === "string" ? payload.sub : undefined
    if (!userId) return { ok: false }
    const appMeta = (payload.app_metadata || {}) as { role?: string }
    const role = appMeta.role
    if (role !== "admin" && role !== "staff" && role !== "superadmin") {
      return { ok: false }
    }
    return { ok: true, userId, role }
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public payment / auth / storage shims — never gate these.
  if (
    pathname.startsWith("/api/payment/") ||
    pathname.startsWith("/api/paystack/") ||
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

  const token = extractToken(request)
  if (!token) {
    return redirectLogin(request, pathname)
  }

  if (usePlainPg()) {
    const verified = await verifyPlainPgAdmin(token)
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
    "/api/paystack/:path*",
    "/auth/v1/:path*",
    "/rest/v1/:path*",
    "/storage/v1/:path*",
    "/api/service-worker",
  ],
}
