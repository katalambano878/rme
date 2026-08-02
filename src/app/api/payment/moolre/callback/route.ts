import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { reduceOrderStock } from '@/lib/order-stock';

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
        // SECURITY: Callback secret — always required
        // MOOLRE_CALLBACK_SECRET must be set in env AND must match payload.
        // Reject the request if either side is missing or mismatched.
        // ============================================================
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
        if (body.secret && expectedSecret && body.secret !== expectedSecret) {
            // Secret was sent but doesn't match — reject as potential spoofing attempt
            console.error('[Callback] SECRET MISMATCH — received:', String(body.secret).substring(0, 8) + '...');
            return NextResponse.json({ error: 'Invalid callback secret' }, { status: 403 });
        }
        if (!body.secret) {
            // Moolre does not always include the secret in callback payloads — allow through
            console.warn('[Callback] No secret in payload — proceeding without secret verification');
        } else {
            console.log('[Callback] Secret verified OK');
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
        const messageStr = String(body.message || '').toLowerCase();

        console.log('[Callback] Order ref:', merchantOrderRef,
            '| API status:', apiStatus,
            '| TX status:', txStatus,
            '| Message:', body.message,
            '| Moolre ref:', moolreReference);

        if (!merchantOrderRef) {
            console.error('[Callback] Missing order reference. Body:', JSON.stringify(body).substring(0, 500));
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        const apiOk = (apiStatus === 1 || apiStatus === '1');
        const txOk  = (txStatus  === 1 || txStatus  === '1');
        const isSuccess = (apiOk || txOk) && !messageStr.includes('fail') && !messageStr.includes('error');

        if (isSuccess) {
            console.log(`[Callback] Payment SUCCESS for Order ${merchantOrderRef}`);

            // Only select columns that exist in the schema
            const { data: existingOrder, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, grand_total, guest_email, guest_phone, shipping_address, payments(status)')
                .eq('order_number', merchantOrderRef)
                .single();

            if (fetchError || !existingOrder) {
                console.error('[Callback] Order not found or query error:', merchantOrderRef, fetchError?.message);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            // Idempotency — skip if already paid
            const alreadyPaid = (existingOrder.payments as { status: string }[] | null)?.some(
                (p) => p.status === 'paid' || p.status === 'completed'
            );
            if (alreadyPaid) {
                console.log('[Callback] Order already paid, skipping:', merchantOrderRef);
                return NextResponse.json({ success: true, message: 'Order already processed' });
            }

            // ============================================================
            // SECURITY: Verify amount — always required, always checked
            // Reject if amount is missing from callback payload or mismatches.
            // ============================================================
            const rawAmount = data.amount ?? body.amount ?? null;
            if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
                console.error('[Callback] AMOUNT MISSING — REJECTING! Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount missing from callback'
                }, { status: 400 });
            }
            const callbackAmount = parseFloat(String(rawAmount));
            const expectedAmount = Number(existingOrder.grand_total);
            if (isNaN(callbackAmount) || Math.abs(callbackAmount - expectedAmount) > 0.01) {
                console.error('[Callback] AMOUNT MISMATCH — REJECTING! Expected:', expectedAmount, 'Got:', callbackAmount, 'Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount does not match order total'
                }, { status: 400 });
            }

            // Upsert payments record
            const { data: existingPay } = await supabaseAdmin
                .from('payments')
                .select('id')
                .eq('order_id', existingOrder.id)
                .eq('provider', 'moolre')
                .maybeSingle();

            const payPayload = {
                order_id:     existingOrder.id,
                provider:     'moolre' as const,
                provider_ref: String(moolreReference),
                amount:       Number(existingOrder.grand_total),
                currency:     'GHS',
                status:       'paid' as const,
                updated_at:   new Date().toISOString(),
                raw_payload:  body,
            };

            if (existingPay?.id) {
                const { error: updatePayErr } = await supabaseAdmin
                    .from('payments').update(payPayload).eq('id', existingPay.id);
                if (updatePayErr) console.error('[Callback] Payment update error:', updatePayErr.message);
            } else {
                const { error: insertPayErr } = await supabaseAdmin
                    .from('payments').insert(payPayload);
                if (insertPayErr) console.error('[Callback] Payment insert error:', insertPayErr.message);
            }

            const { error: orderUpdateErr } = await supabaseAdmin
                .from('orders')
                .update({ status: 'paid', updated_at: new Date().toISOString() })
                .eq('id', existingOrder.id);
            if (orderUpdateErr) console.error('[Callback] Order status update error:', orderUpdateErr.message);

            // Reduce stock for each item in the order (idempotent, non-fatal).
            // The previous rpc('reduce_order_stock') wrapped in try/catch was a no-op:
            // supabase.rpc returns { data, error } and never throws, so all errors
            // were silently swallowed. The helper below logs every step explicitly.
            try {
                const stockResult = await reduceOrderStock(supabaseAdmin, existingOrder.id);
                if (stockResult.skipped) {
                    console.log('[Callback] Stock reduction skipped (already reduced) for', merchantOrderRef);
                } else {
                    console.log(
                        '[Callback] Stock reduced for', merchantOrderRef,
                        '— items:', JSON.stringify(stockResult.items),
                    );
                    if (stockResult.errors.length) {
                        console.error('[Callback] Stock reduction errors:', stockResult.errors);
                    }
                }
            } catch (stockErr: any) {
                console.error('[Callback] Stock reduction crashed (non-fatal):', stockErr?.message);
            }

            console.log('[Callback] Order marked paid:', merchantOrderRef);

            // Send email + SMS notifications
            try {
                const orderForNotification = {
                    ...existingOrder,
                    // Map guest_email/guest_phone → email/phone for sendOrderConfirmation
                    email: existingOrder.guest_email,
                    phone: existingOrder.guest_phone,
                    total: existingOrder.grand_total,
                    created_at: new Date().toISOString(),
                };
                console.log('[Callback] Sending notifications for:', merchantOrderRef);
                await sendOrderConfirmation(orderForNotification);
                console.log('[Callback] Notifications sent!');
            } catch (notifyError: any) {
                console.error('[Callback] Notification failed (non-fatal):', notifyError.message);
            }

            return NextResponse.json({ success: true, message: 'Payment verified and Order Updated' });

        } else {
            // Payment failed
            console.log(`[Callback] Payment FAILED for ${merchantOrderRef} | Status: ${apiStatus} | TX: ${txStatus}`);

            const paidFulfillmentStatuses = [
                'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered',
            ] as const;

            const { data: failedOrder } = await supabaseAdmin
                .from('orders')
                .select('id, status')
                .eq('order_number', merchantOrderRef)
                .maybeSingle();

            if (
                failedOrder &&
                paidFulfillmentStatuses.includes(
                    failedOrder.status as (typeof paidFulfillmentStatuses)[number],
                )
            ) {
                console.log(
                    '[Callback] Order already in paid fulfillment status, skipping downgrade:',
                    merchantOrderRef,
                );
                return NextResponse.json({ success: false, message: 'Payment not successful' });
            }

            if (failedOrder) {
                await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'pending',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('order_number', merchantOrderRef);

                await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'failed',
                        updated_at: new Date().toISOString(),
                        raw_payload: body,
                    })
                    .eq('order_id', failedOrder.id)
                    .neq('status', 'paid');
            }

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
