import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const row = await queryOne<{ feature_flags: unknown }>(
      `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
    )

    const flags = (row?.feature_flags as Record<string, unknown> | null) ?? {}
    const fee = typeof flags.delivery_fee === "number" ? flags.delivery_fee : 25

    return NextResponse.json({ delivery_fee: fee })
  } catch {
    return NextResponse.json({ delivery_fee: 25 })
  }
}
