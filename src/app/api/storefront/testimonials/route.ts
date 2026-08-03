import { NextResponse } from "next/server"
import { fetchActiveTestimonials } from "@/lib/storefront-content"

export async function GET() {
  try {
    const testimonials = await fetchActiveTestimonials(6)
    return NextResponse.json(testimonials)
  } catch {
    return NextResponse.json([])
  }
}
