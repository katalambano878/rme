import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  // Shipping is confirmed by the store after order — never charged at checkout.
  return NextResponse.json({ delivery_fee: 0 })
}
