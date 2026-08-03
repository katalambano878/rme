"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

export type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  permissions?: Record<string, unknown> | null
}

export type AuthUser = {
  id: string
  email: string
  role: string
  full_name?: string | null
}

export function useAdminUser() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api<{ user: AuthUser; profile: AdminProfile }>("/api/auth/me")
        if (cancelled) return
        setUser(data.user)
        setProfile(data.profile)
      } catch {
        if (cancelled) return
        setUser(null)
        setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" })
    } catch {
      /* ignore */
    }
    router.push("/admin/login")
    router.refresh()
  }, [router])

  return { user, profile, loading, signOut }
}
