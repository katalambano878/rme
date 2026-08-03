import { NextRequest, NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
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
      shippingCost: shippingCostRaw,
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

    const orderNumber = generateOrderNumber()

    // SECURITY: Recompute every price server-side from the database. NEVER
    // trust client-supplied price/subtotal/total or an attacker can buy
    // anything for GH₵ 1.
    const productIds = Array.from(
      new Set(items.map((i: any) => i.productId).filter((id: any) => id != null && id !== "null")),
    ) as string[]
    const productsNeedingVariants = Array.from(
      new Set(
        items
          .filter((i: any) => i.selectedSize || i.selectedColor)
          .map((i: any) => i.productId)
          .filter(Boolean),
      ),
    )

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

    let products: DbProduct[] = []
    let allVariants: DbVariant[] = []
    let siteSettingsRow: { feature_flags: unknown } | null = null

    try {
      const [productsResult, variantsResult, settingsResult] = await Promise.all([
        productIds.length
          ? query<DbProduct>(
              `SELECT id, name, price, sale_price, compare_at_price, status
               FROM products
               WHERE id = ANY($1::uuid[])`,
              [productIds],
            )
          : Promise.resolve({ rows: [] as DbProduct[] }),
        productsNeedingVariants.length
          ? query<DbVariant>(
              `SELECT id, product_id, price, sale_price, compare_at_price, sku, option_values
               FROM variants
               WHERE product_id = ANY($1::uuid[])`,
              [productsNeedingVariants],
            )
          : Promise.resolve({ rows: [] as DbVariant[] }),
        queryOne<{ feature_flags: unknown }>(
          `SELECT feature_flags FROM site_settings WHERE id = 1 LIMIT 1`,
        ),
      ])
      products = productsResult.rows
      allVariants = variantsResult.rows
      siteSettingsRow = settingsResult
    } catch (e) {
      console.error("Order init: price lookup failed", e)
      return NextResponse.json({ error: "Failed to verify cart" }, { status: 500 })
    }

    const featureFlags = (siteSettingsRow?.feature_flags as Record<string, unknown> | null) ?? {}
    const saleEnabled = featureFlags.sale_promotion_enabled === true

    const productMap = new Map<string, DbProduct>(products.map((p) => [p.id, p]))
    const variantsByProduct = new Map<string, DbVariant[]>()
    for (const v of allVariants) {
      const arr = variantsByProduct.get(v.product_id) ?? []
      arr.push(v)
      variantsByProduct.set(v.product_id, arr)
    }

    function matchVariantByOptions(
      productId: string,
      selectedSize?: string,
      selectedColor?: string,
    ): DbVariant | undefined {
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

      const allProductVariants = variantsByProduct.get(product.id) ?? []
      const matchedVariant =
        it.selectedSize || it.selectedColor
          ? matchVariantByOptions(product.id, it.selectedSize, it.selectedColor)
          : allProductVariants.length > 0
            ? [...allProductVariants].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))[0]
            : undefined

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

    // Never trust client shippingCost — load fee from site_settings (pickup = 0)
    void shippingCostRaw
    let shippingCost = 0
    const method = String(shippingMethod || "").toLowerCase()
    if (method !== "pickup" && method !== "store_pickup") {
      const flags = (siteSettingsRow?.feature_flags as Record<string, unknown> | null) ?? {}
      shippingCost =
        typeof flags.delivery_fee === "number" && Number.isFinite(flags.delivery_fee)
          ? Math.max(0, flags.delivery_fee)
          : 25
    }
    const computedTotal = Number((computedSubtotal + shippingCost).toFixed(2))

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

    const order = await queryOne<{ id: string }>(
      `INSERT INTO orders (
         order_number, guest_email, guest_phone, status,
         subtotal, shipping_total, discount_total, tax_total, grand_total,
         currency, shipping_address, billing_address, notes
       )
       VALUES ($1, $2, $3, 'pending', $4, $5, 0, 0, $6, 'GHS', $7::jsonb, $8::jsonb, $9)
       RETURNING id`,
      [
        orderNumber,
        trimmedEmail || null,
        phone || null,
        computedSubtotal,
        shippingCost,
        computedTotal,
        JSON.stringify(shippingAddress),
        JSON.stringify(shippingAddress),
        `Shipping: ${shippingMethod}`,
      ],
    )

    if (!order) {
      console.error("Order creation failed")
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    try {
      await withTransaction(async (client) => {
        for (const item of serverItems) {
          await client.query(
            `INSERT INTO order_items (
               order_id, product_id, variant_id, name_snapshot, sku_snapshot,
               unit_price, quantity, line_total, options_snapshot
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
            [
              order.id,
              item.productId,
              item.variantId,
              item.name,
              item.sku,
              item.unitPrice,
              item.quantity,
              item.lineTotal,
              item.optionsSnapshot ? JSON.stringify(item.optionsSnapshot) : null,
            ],
          )
        }
      })
    } catch (e) {
      console.error("Order items insert failed:", e)
    }

    if (useMoolre) {
      return NextResponse.json({
        order_id: order.id,
        order_number: orderNumber,
        payment_provider: "moolre",
      })
    }

    const amountInPesewas = Math.round(computedTotal * 100)
    const appBase = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
      /\/+$/,
      "",
    )
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

    await query(
      `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, status)
       VALUES ($1, 'paystack', $2, $3, 'GHS', 'pending')`,
      [order.id, paystackData.data.reference, computedTotal],
    )

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
