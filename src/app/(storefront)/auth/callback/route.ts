import { NextResponse } from "next/server"

/**
 * Legacy Supabase OAuth/email-confirm callback.
 * Auth is now JWT-cookie based via /api/auth/* — redirect home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next") || "/"
  return NextResponse.redirect(new URL(next, url.origin))
}
