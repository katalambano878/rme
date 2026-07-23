import { NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase-admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const featured = searchParams.get("featured") === "true"
  const limit = parseInt(searchParams.get("limit") || "50", 10)

  try {
    let query = supabase
      .from("products")
      .select("id, name, slug, product_images(url)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (featured) {
      query = query.eq("is_featured", true)
    }

    const { data, error } = await query
    if (error) {
      console.error("[Storefront API] Products error:", error)
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
    }

    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Storefront API] Error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
