import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("site_settings")
      .select("feature_flags")
      .eq("id", 1)
      .maybeSingle()

    const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {}
    const fee = typeof flags.delivery_fee === "number" ? flags.delivery_fee : 25

    return NextResponse.json({ delivery_fee: fee })
  } catch {
    return NextResponse.json({ delivery_fee: 25 })
  }
}
