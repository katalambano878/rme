import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { queryOne } from "@/lib/db"

export async function GET(request: Request) {
  const result = await verifyAuth(request)
  if (!result.authenticated || !result.user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  let profile: {
    id: string
    email: string | null
    full_name: string | null
    role: string
    permissions: Record<string, unknown> | null
  } | null = null

  try {
    profile = await queryOne(
      `SELECT id, email, full_name, role::text AS role, permissions
       FROM public.profiles
       WHERE id = $1
       LIMIT 1`,
      [result.user.id],
    )
  } catch {
    profile = await queryOne(
      `SELECT id, email, full_name, role::text AS role, NULL::jsonb AS permissions
       FROM public.profiles
       WHERE id = $1
       LIMIT 1`,
      [result.user.id],
    )
  }

  return NextResponse.json({
    user: result.user,
    profile: profile || {
      id: result.user.id,
      email: result.user.email,
      full_name: result.user.full_name ?? null,
      role: result.user.role,
      permissions: null,
    },
  })
}
