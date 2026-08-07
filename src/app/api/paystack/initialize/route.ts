import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateOrderNumber } from "@/lib/utils"
import { effectivePriceForVariant } from "@/lib/effective-price"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email,
      phone,
      firstName,
      lastName,
      address1,
      address2,
      city,
      region,
      country,
      postalCode,
      shippingMethod,
      items,
      paymentProvider,
    } = body

    const useMoolre = paymentProvider === "moolre"

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing items" }, { status: 400 })
    }

    // Validate item shape: positive integer quantity, valid product/variant id
    for (const it of items) {
      const qty = Number(it?.quantity)
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
      }
      if (!it?.productId && !it?.variantId) {
        return NextResponse.json({ error: "Missing productId/variantId" }, { status: 400 })
      }
    }

    const trimmedEmail = typeof email === "string" ? email.trim() : ""

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!useMoolre && !secretKey) {
      return NextResponse.json({ error: "Paystack not configured" }, { status: 500 })
    }

    const supabase = createAdminClient()
    const orderNumber = generateOrderNumber()

    // SECURITY: Recompute every price server-side from the database. NEVER
    // trust client-supplied price/subtotal/total or an attacker can buy
    // anything for GH₵ 1.
    const productIds = Array.from(
      new Set(items.map((i: any) => i.productId).filter((id: any) => id != null && id !== "null")),
    ) as string[]
    const variantIds = Array.from(
      new Set(items.map((i: any) => i.variantId).filter((id: any) => id != null && id !== "null")),
    ) as string[]

    type DbProduct = {
      id: string
      name: string
      price: number | string
      sale_price: number | string | null
      compare_at_price: number | string | null
      status: string
    }
    type DbVariant = {
      id: string
      product_id: string
      price: number | string | null
      sale_price: number | string | null
      compare_at_price: number | string | null
      sku: string | null
      option_values: { name: string; value: string }[] | null
    }

    // Fetch products + all variants for products that have selected options (for variant resolution)
    const productsNeedingVariants = Array.from(new Set(
      items.filter((i: any) => i.selectedSize || i.selectedColor).map((i: any) => i.productId).filter(Boolean)
    ))

    // We need the global sale toggle so the server applies the SAME pricing
    // rules the storefront UI showed the customer. If we don't honor the
    // toggle, we'd charge the sale price even when the storefront is hiding
    // sales — that's overcharging silently. (See lib/effective-price.ts.)
    const [productsRes, allVariantsRes, siteSettingsRes] = await Promise.all([
      productIds.length
        ? supabase
            .from("products")
            .select("id, name, price, sale_price, compare_at_price, status")
            .in("id", productIds)
        : Promise.resolve({ data: [] as DbProduct[], error: null }),
      productsNeedingVariants.length
        ? supabase
            .from("variants")
            .select("id, product_id, price, sale_price, compare_at_price, sku, option_values")
            .in("product_id", productsNeedingVariants)
        : Promise.resolve({ data: [] as DbVariant[], error: null }),
      supabase.from("site_settings").select("feature_flags").eq("id", 1).maybeSingle(),
    ])

    if (productsRes.error || allVariantsRes.error) {
      console.error("Order init: price lookup failed", productsRes.error || allVariantsRes.error)
      return NextResponse.json({ error: "Failed to verify cart" }, { status: 500 })
    }

    const featureFlags = (siteSettingsRes.data?.feature_flags as Record<string, unknown> | null) ?? {}
    const saleEnabled = featureFlags.sale_promotion_enabled === true

    const productMap = new Map<string, DbProduct>(
      ((productsRes.data as DbProduct[]) || []).map((p) => [p.id, p]),
    )
    // Group variants by product_id for option-based matching
    const variantsByProduct = new Map<string, DbVariant[]>()
    for (const v of (allVariantsRes.data as DbVariant[]) || []) {
      const arr = variantsByProduct.get(v.product_id) ?? []
      arr.push(v)
      variantsByProduct.set(v.product_id, arr)
    }

    function matchVariantByOptions(productId: string, selectedSize?: string, selectedColor?: string): DbVariant | undefined {
      const variants = variantsByProduct.get(productId) ?? []
      return variants.find((v) => {
        const opts = v.option_values ?? []
        const sizeOk = !selectedSize || opts.some((o) => o.value === selectedSize)
        const colorOk = !selectedColor || opts.some((o) => o.value === selectedColor)
        return sizeOk && colorOk
      })
    }

    type ServerItem = {
      productId: string | null
      variantId: string | null
      name: string
      sku: string
      unitPrice: number
      quantity: number
      lineTotal: number
      optionsSnapshot: Record<string, string> | null
    }

    const serverItems: ServerItem[] = []
    let computedSubtotal = 0
    for (const it of items) {
      const product = it.productId ? productMap.get(String(it.productId)) : undefined

      if (!product || product.status !== "active") {
        return NextResponse.json(
          { error: `Product not available: ${it.productId}` },
          { status: 400 },
        )
      }

      // Try to resolve the exact variant by selected options. When the
      // customer didn't pick options (simple product) we still want variant
      // pricing if the product has variants, because the sale_price/
      // compare_at_price often lives on the cheapest variant.
      const allVariants = variantsByProduct.get(product.id) ?? []
      const matchedVariant = (it.selectedSize || it.selectedColor)
        ? matchVariantByOptions(product.id, it.selectedSize, it.selectedColor)
        : allVariants.length > 0
          ? [...allVariants].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))[0]
          : undefined

      // Use the SAME effective-price logic the storefront uses to decide what
      // to display in the cart. Without this, the cart shows GH₵ 8 (sale)
      // but Paystack would charge GH₵ 10 (regular) — which is the deception
      // bug we're fixing.
      const pricing = matchedVariant
        ? effectivePriceForVariant(matchedVariant, product, saleEnabled)
        : effectivePriceForVariant(
            {
              price: product.price,
              sale_price: product.sale_price,
              compare_at_price: product.compare_at_price,
            },
            product,
            saleEnabled,
          )

      const unitPrice = pricing.effective
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return NextResponse.json({ error: "Invalid product price" }, { status: 400 })
      }

      const qty = Number(it.quantity)
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      computedSubtotal += lineTotal

      const optionsSnapshot: Record<string, string> | null =
        it.selectedSize || it.selectedColor
          ? {
              ...(it.selectedSize ? { size: it.selectedSize } : {}),
              ...(it.selectedColor ? { color: it.selectedColor } : {}),
            }
          : null

      serverItems.push({
        productId: product.id,
        variantId: matchedVariant?.id ?? null,
        name: product.name,
        sku: matchedVariant?.sku ?? "",
        unitPrice,
        quantity: qty,
        lineTotal,
        optionsSnapshot,
      })
    }

    // Shipping is confirmed by the store after order — never charge at checkout.
    const shippingCost = 0
    const computedTotal = Number(computedSubtotal.toFixed(2))

    if (computedTotal <= 0) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 })
    }

    const phoneDigits = String(phone ?? "").replace(/\D/g, "")
    const paystackCustomerEmail =
      trimmedEmail ||
      (phoneDigits.length > 0
        ? `${phoneDigits}@guest.checkout`
        : `guest-${orderNumber.replace(/[^A-Za-z0-9]/g, "")}@guest.checkout`)

    const shippingAddress = {
      firstName,
      lastName,
      address1,
      address2: address2 || "",
      city,
      region,
      country,
      postalCode: postalCode || "",
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        guest_email: trimmedEmail || null,
        guest_phone: phone || null,
        status: "pending",
        subtotal: computedSubtotal,
        shipping_total: shippingCost,
        discount_total: 0,
        tax_total: 0,
        grand_total: computedTotal,
        currency: "GHS",
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        notes: `Shipping: ${shippingMethod}`,
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      console.error("Order creation failed:", orderErr)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    const orderItems = serverItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      variant_id: item.variantId,
      name_snapshot: item.name,
      sku_snapshot: item.sku,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      line_total: item.lineTotal,
      options_snapshot: item.optionsSnapshot,
    }))

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems)
    if (itemsErr) {
      console.error("Order items insert failed:", itemsErr)
    }

    if (useMoolre) {
      return NextResponse.json({
        order_id: order.id,
        order_number: orderNumber,
        payment_provider: "moolre",
      })
    }

    const amountInPesewas = Math.round(computedTotal * 100)
    const appBase = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")
    const callbackUrl = `${appBase}/checkout/callback?reference=${orderNumber}`

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: paystackCustomerEmail,
        amount: amountInPesewas,
        currency: "GHS",
        reference: orderNumber,
        callback_url: callbackUrl,
        metadata: {
          order_id: order.id,
          order_number: orderNumber,
          custom_fields: [
            { display_name: "Customer Name", variable_name: "customer_name", value: `${firstName} ${lastName}` },
            { display_name: "Phone", variable_name: "phone", value: phone || "N/A" },
          ],
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      console.error("Paystack initialize failed:", paystackData)
      return NextResponse.json({ error: paystackData.message || "Payment init failed" }, { status: 502 })
    }

    await supabase.from("payments").insert({
      order_id: order.id,
      provider: "paystack",
      provider_ref: paystackData.data.reference,
      amount: computedTotal,
      currency: "GHS",
      status: "pending",
    })

    return NextResponse.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      order_id: order.id,
      order_number: orderNumber,
    })
  } catch (err) {
    console.error("Paystack initialize error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
