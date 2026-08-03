import { type NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, isStaffRole, verifySessionToken } from "@/lib/auth/token"

const COOKIE_NAME = AUTH_COOKIE_NAME()

/** Public payment/SMS callbacks must never be blocked by auth middleware. */
const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/paystack/webhook",
  "/api/paystack/verify",
  "/api/paystack/initialize",
  "/api/payment/moolre",
  "/api/orders/track",
  "/api/settings/delivery-fee",
  "/api/products/search",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/recaptcha",
  "/api/chat",
  "/api/uploads/",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  if (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")

    if (pathname === "/admin/login") {
      return response
    }

    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token) {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const session = await verifySessionToken(token)
      if (!session || !isStaffRole(session.role)) {
        const loginUrl = new URL("/admin/login", request.url)
        loginUrl.searchParams.set("error", session ? "unauthorized" : "session_expired")
        return NextResponse.redirect(loginUrl)
      }

      if (pathname.startsWith("/superadmin") && session.role !== "superadmin") {
        return NextResponse.redirect(new URL("/", request.url))
      }

      response.headers.set("x-user-id", session.sub)
      response.headers.set("x-user-role", session.role)
    } catch {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("error", "session_expired")
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store")
    // Callbacks and public APIs: pass through (auth checked inside routes when needed)
    void PUBLIC_API_PREFIXES
  }

  return response
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/superadmin/:path*",
    "/api/:path*",
  ],
}
