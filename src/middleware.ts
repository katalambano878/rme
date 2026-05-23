import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Single Supabase server client with full cookie read/write so sessions refresh correctly.
 * Previously a second client used setAll() {} which broke getUser() after login.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) {
    /** Allow signing in without already having a session */
    if (pathname === "/admin/login") {
      return response
    }

    if (!user) {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      const redirect = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach((c) => {
        redirect.cookies.set(c.name, c.value, c)
      })
      return redirect
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

    if (pathname.startsWith("/admin") && !["admin", "superadmin", "staff"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
