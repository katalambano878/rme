"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: string
}

export function useAdminUser() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!u) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(u)
      const { data: row } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", u.id)
        .single()
      if (cancelled) return
      if (row) {
        setProfile({
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          role: row.role,
        })
      } else {
        setProfile(null)
      }
      setLoading(false)
    }

    load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }, [router])

  return { user, profile, loading, signOut }
}
