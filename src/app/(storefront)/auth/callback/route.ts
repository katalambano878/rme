import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Returns true if `path` is a safe same-origin path:
 *   - starts with a single "/"
 *   - does NOT start with "//" (protocol-relative URL — would redirect off-site)
 *   - does NOT start with "/\\" (Windows-style backslash trick)
 *   - does NOT contain a scheme like "javascript:"
 */
function safePath(input: string | null): string {
  if (!input) return "/"
  const path = input.trim()
  if (!path.startsWith("/")) return "/"
  if (path.startsWith("//") || path.startsWith("/\\")) return "/"
  // Strip any embedded CR/LF that could trick header injection downstream
  if (/[\r\n]/.test(path)) return "/"
  return path
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safePath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // SECURITY: Always redirect to our own origin. Do NOT trust
      // x-forwarded-host (settable by any upstream proxy / preview deploy).
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
