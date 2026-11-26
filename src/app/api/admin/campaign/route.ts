import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { campaignState, campaignToFlags, parseCampaign, type Campaign } from "@/lib/effective-price"

export const dynamic = "force-dynamic"

async function readFlags(): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from("site_settings").select("feature_flags").eq("id", 1).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.feature_flags as Record<string, unknown> | null) ?? {}
}

/** The scheduled campaign (Black Friday etc.) and whether it is live right now. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  try {
    const campaign = parseCampaign(await readFlags())
    return NextResponse.json({ campaign, state: campaignState(campaign) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load" }, { status: 500 })
  }
}

/** Save (or with `{ remove: true }`, delete) the campaign. */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authenticated) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Partial<Campaign> & { remove?: boolean }
  let next: Campaign | null = null

  if (!body.remove) {
    const start = Date.parse(String(body.startsAt || ""))
    const end = Date.parse(String(body.endsAt || ""))
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return NextResponse.json({ error: "Choose a start and an end date and time." }, { status: 400 })
    }
    if (end <= start) {
      return NextResponse.json({ error: "The end must be after the start." }, { status: 400 })
    }
    if (end - start > 45 * 86_400_000) {
      return NextResponse.json({ error: "A campaign can run for at most 45 days." }, { status: 400 })
    }
    const pct = Math.round(Number(body.discountPercent))
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) {
      return NextResponse.json({ error: "The discount must be between 0% and 90%." }, { status: 400 })
    }
    next = {
      enabled: body.enabled !== false,
      name: String(body.name || "Black Friday").trim().slice(0, 40) || "Black Friday",
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      discountPercent: pct,
      message: String(body.message || "").replace(/[\r\n]+/g, " ").trim().slice(0, 160),
    }
  }

  try {
    const flags = campaignToFlags(next, await readFlags())
    const { error } = await supabaseAdmin.from("site_settings").update({ feature_flags: flags }).eq("id", 1)
    if (error) throw new Error(error.message)
    return NextResponse.json({ campaign: next, state: campaignState(next) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save" }, { status: 500 })
  }
}
