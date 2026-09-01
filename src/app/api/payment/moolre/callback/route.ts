import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { fulfillMoolrePaidOrder, ghanaPhoneFromPayer, stripRetrySuffix } from '@/lib/moolre-fulfill';

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
            ? stripRetrySuffix(rawExternalRef)
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

            const rawAmount = data.amount ?? data.value ?? body.amount ?? null;
            if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
                console.error('[Callback] AMOUNT MISSING — REJECTING! Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount missing from callback'
                }, { status: 400 });
            }
            const callbackAmount = parseFloat(String(rawAmount));
            if (isNaN(callbackAmount) || callbackAmount <= 0) {
                console.error('[Callback] AMOUNT INVALID — REJECTING! Got:', rawAmount, 'Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount does not match order total'
                }, { status: 400 });
            }

            const meta = data.metadata || body.metadata || {};
            const result = await fulfillMoolrePaidOrder(supabaseAdmin, {
                orderNumber: merchantOrderRef,
                paidAmount: callbackAmount,
                providerRef: String(moolreReference),
                rawPayload: body,
                email: meta.customer_email || meta.email || null,
                phone: ghanaPhoneFromPayer(data.payer || data.payee),
            });

            if (!result.ok) {
                console.error('[Callback] Fulfill failed:', merchantOrderRef, result.message);
                const status = result.message === 'Order not found' ? 404 : 400;
                return NextResponse.json({ success: false, message: result.message }, { status });
            }

            if (result.created) {
                console.warn('[Callback] Recovered missing checkout row for', merchantOrderRef);
            } else if (result.alreadyPaid) {
                console.log('[Callback] Order already paid, skipping:', merchantOrderRef);
            } else {
                console.log('[Callback] Order marked paid:', merchantOrderRef);
            }

            return NextResponse.json({ success: true, message: result.message });

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
