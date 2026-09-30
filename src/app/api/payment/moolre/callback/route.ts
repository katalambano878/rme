import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { fulfillMoolrePaidOrder, ghanaPhoneFromPayer, redactPaymentPayload, stripRetrySuffix } from '@/lib/moolre-fulfill';
import { verifyMoolrePayment } from '@/lib/moolre-status';

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

        const storedPayload = redactPaymentPayload(body);

        // Log every incoming callback to webhook_logs for diagnostics
        try {
            await supabaseAdmin.from('webhook_logs').insert({
                provider: 'moolre',
                event_type: 'callback',
                payload: storedPayload,
                headers: { 'content-type': contentType, 'x-forwarded-for': req.headers.get('x-forwarded-for') },
                status_code: 0, // will be updated below if needed
            });
        } catch { /* non-fatal */ }

        // A mismatched secret is always rejected. A missing secret is not trusted
        // on its own — payment is confirmed with Moolre's status API below.
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
        if (body.secret && expectedSecret && body.secret !== expectedSecret) {
            console.error('[Callback] SECRET MISMATCH');
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
            console.log(`[Callback] Payment claimed for Order ${merchantOrderRef}`);

            const refsToVerify = [rawExternalRef, data.transactionid, data.thirdpartyref]
                .map((value) => (value == null ? "" : String(value).trim()))
                .filter((value) => value.length > 0);
            const verified = await verifyMoolrePayment(refsToVerify);
            const txOrder = stripRetrySuffix(String(verified.tx?.externalref || ""));
            const claimedOrder = stripRetrySuffix(String(merchantOrderRef));
            const paidAmount = parseFloat(String(verified.tx?.amount ?? verified.tx?.value ?? ""));
            if (
                !verified.ok ||
                !verified.tx ||
                !Number.isFinite(paidAmount) ||
                paidAmount <= 0 ||
                (txOrder && txOrder !== claimedOrder)
            ) {
                console.error('[Callback] Moolre did not confirm payment for', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment not confirmed',
                }, { status: 400 });
            }

            const meta = data.metadata || body.metadata || {};
            const result = await fulfillMoolrePaidOrder(supabaseAdmin, {
                orderNumber: merchantOrderRef,
                paidAmount,
                providerRef: String(verified.tx.transactionid || moolreReference),
                rawPayload: storedPayload,
                email: meta.customer_email || meta.email || null,
                phone: ghanaPhoneFromPayer(verified.tx.payer || data.payer || data.payee),
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
                        raw_payload: storedPayload,
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
