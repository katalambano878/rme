import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { fulfillPaidOrder } from '@/lib/payments/fulfill-paid-order';
import { normalizeMoolreStatus } from '@/lib/payments/status';

/**
 * Moolre Callback Payload Structure (actual API response):
 * {
 *   "status": 1,
 *   "code": "P01",
 *   "message": "Transaction Successful",
 *   "data": {
 *     "txtstatus": 1,
 *     "payer": "233535998837",
 *     "terminalid": "",
 *     "accountnumber": "...",
 *     "name": "",
 *     "amount": "2",
 *     "value": "2",
 *     "transactionid": "42252702",
 *     "externalref": "ORD-...-R...",
 *     "thirdpartyref": "74658410493"
 *   },
 *   "secret": "<MOOLRE_CALLBACK_SECRET>",
 *   "ts": "2026-02-05 22:21:16",
 *   "go": null
 * }
 */

export async function POST(req: Request) {
    console.log('[Callback] POST received at', new Date().toISOString());

    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`callback:${clientId}`, RATE_LIMITS.callback);
        if (!rateLimitResult.success) {
            console.warn('[Callback] Rate limited:', clientId);
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        let body: any = {};
        const contentType = req.headers.get('content-type') || '';

        try {
            if (contentType.includes('application/json')) {
                body = await req.json();
            } else if (contentType.includes('form')) {
                const formData = await req.formData();
                body = Object.fromEntries(formData.entries());
            } else {
                const rawText = await req.text();
                try {
                    body = JSON.parse(rawText);
                } catch {
                    try {
                        body = Object.fromEntries(new URLSearchParams(rawText).entries());
                    } catch {
                        console.warn('[Callback] Could not parse body');
                    }
                }
            }
        } catch {
            console.error('[Callback] Body parsing failed');
            return NextResponse.json({ success: false, message: 'Invalid Request Body' }, { status: 400 });
        }

        console.log('[Callback] Body keys:', Object.keys(body).join(', '));
        console.log('[Callback] Data keys:', body.data ? Object.keys(body.data).join(', ') : 'no data object');

        // Log every incoming callback to webhook_logs for diagnostics
        try {
            await supabaseAdmin.from('webhook_logs').insert({
                provider: 'moolre',
                event_type: 'callback',
                payload: body,
                headers: { 'content-type': contentType, 'x-forwarded-for': req.headers.get('x-forwarded-for') },
                status_code: 0, // will be updated below if needed
            });
        } catch { /* non-fatal */ }

        // ============================================================
        // SECURITY: Callback secret — always required on both sides.
        // Never accept callbacks when MOOLRE_CALLBACK_SECRET is unset,
        // or when the payload secret is missing/mismatched.
        // ============================================================
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET?.trim();
        if (!expectedSecret) {
            console.error('[Callback] MOOLRE_CALLBACK_SECRET is not configured — rejecting all callbacks');
            return NextResponse.json({ error: 'Callback verification not configured' }, { status: 503 });
        }
        if (!body.secret || String(body.secret) !== expectedSecret) {
            console.error('[Callback] SECRET MISSING OR MISMATCH');
            return NextResponse.json({ error: 'Invalid callback secret' }, { status: 403 });
        }

        // ============================================================
        // EXTRACT FIELDS — Moolre nests payment data inside body.data
        // ============================================================
        const data = body.data || {};

        const rawExternalRef =
            data.externalref ||
            data.external_reference ||
            data.orderRef ||
            body.externalref ||
            body.orderRef ||
            body.external_reference;

        // Strip retry suffix: "ORD-123-R1770000000" → "ORD-123"
        const merchantOrderRef = rawExternalRef
            ? rawExternalRef.replace(/-R\d+$/, '')
            : (data.metadata?.original_order_number || body.metadata?.original_order_number);

        const moolreReference =
            data.transactionid ||
            data.thirdpartyref ||
            body.reference ||
            'callback';

        // body.status === 1   → API call succeeded
        // data.txstatus === 1 → transaction was successful (actual Moolre field name)
        const apiStatus = body.status;
        const txStatus  = data.txstatus ?? data.txtstatus;

        console.log('[Callback] Order ref:', merchantOrderRef,
            '| API status:', apiStatus,
            '| TX status:', txStatus,
            '| Message:', body.message,
            '| Moolre ref:', moolreReference);

        if (!merchantOrderRef) {
            console.error('[Callback] Missing order reference. Body:', JSON.stringify(body).substring(0, 500));
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        const internal = normalizeMoolreStatus({
            apiStatus,
            txStatus,
            message: body.message,
        });
        const isSuccess = internal === 'successful';

        if (isSuccess) {
            console.log(`[Callback] Payment SUCCESS for Order ${merchantOrderRef}`);

            const { data: existingOrder, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, grand_total, guest_email, guest_phone, shipping_address, payments(status)')
                .eq('order_number', merchantOrderRef)
                .single();

            if (fetchError || !existingOrder) {
                console.error('[Callback] Order not found or query error:', merchantOrderRef, fetchError?.message);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            const rawAmount = data.amount ?? body.amount ?? null;
            if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
                console.error('[Callback] AMOUNT MISSING — REJECTING! Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount missing from callback'
                }, { status: 400 });
            }
            const callbackAmount = parseFloat(String(rawAmount));

            const result = await fulfillPaidOrder(supabaseAdmin, {
                orderId: existingOrder.id,
                orderNumber: existingOrder.order_number,
                provider: 'moolre',
                providerRef: String(moolreReference),
                expectedAmount: Number(existingOrder.grand_total),
                paidAmount: callbackAmount,
                guestEmail: existingOrder.guest_email,
                guestPhone: existingOrder.guest_phone,
                shippingAddress: existingOrder.shipping_address,
                rawPayload: body,
            });

            if (!result.ok) {
                return NextResponse.json(
                    { success: false, message: result.error || 'Fulfillment failed' },
                    { status: result.statusCode || 500 },
                );
            }

            return NextResponse.json({
                success: true,
                message: result.alreadyPaid ? 'Order already processed' : 'Payment verified and Order Updated',
            });

        } else {
            // Payment failed
            console.log(`[Callback] Payment FAILED for ${merchantOrderRef} | Status: ${apiStatus} | TX: ${txStatus}`);

            await supabaseAdmin
                .from('orders')
                .update({
                    status: 'pending',
                    updated_at: new Date().toISOString(),
                })
                .eq('order_number', merchantOrderRef);

            return NextResponse.json({ success: false, message: 'Payment not successful' });
        }

    } catch (error: any) {
        console.error('[Callback] Critical Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}

export async function GET() {
    return new NextResponse(null, { status: 405 });
}
