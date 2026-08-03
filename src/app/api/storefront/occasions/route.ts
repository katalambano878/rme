import { NextResponse } from "next/server"
import { fetchActiveOccasions } from "@/lib/storefront-content"

export async function GET() {
  try {
    const occasions = await fetchActiveOccasions()
    return NextResponse.json(occasions)
  } catch {
    return NextResponse.json([])
  }
}
