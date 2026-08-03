import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { escapeHtml } from '@/lib/sanitize';
import { sendOrderConfirmation, sendOrderStatusUpdate, sendWelcomeMessage, sendContactMessage, sendPaymentLink, sendEmail, sendSMS, emailLayout } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const clientId = getClientIdentifier(request);
        const rateLimitResult = checkRateLimit(`notification:${clientId}`, RATE_LIMITS.notification);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
                    }
                }
            );
        }

        const body = await request.json();
        const { type, payload } = body;

        if (!type || !payload) {
            return NextResponse.json({ error: 'Type and payload required' }, { status: 400 });
        }

        const adminOnlyTypes = ['campaign', 'order_updated', 'order_status', 'payment_link', 'welcome', 'order_created'];
        const requiresAdminAuth = adminOnlyTypes.includes(type);

        if (requiresAdminAuth) {
            const auth = await verifyAuth(request, { requireAdmin: true });
            if (!auth.authenticated) {
                return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
            }
        }

        if (type === 'contact') {
            const contactLimit = checkRateLimit(`contact:${clientId}`, { maxRequests: 3, windowSeconds: 30 * 60 });
            if (!contactLimit.success) {
                return NextResponse.json(
                    { error: 'Too many contact requests. Please try again later.' },
                    { status: 429 },
                );
            }
        }

        if (type === 'order_created') {
            if (!payload.order_number && !payload.id) {
                return NextResponse.json({ error: 'Missing order identifier' }, { status: 400 });
            }

            const orderRef = payload.order_number || payload.id;
            const order = await queryOne<{ id: string; order_number: string; created_at: string }>(
                `SELECT id, order_number, created_at
                 FROM orders
                 WHERE order_number = $1 OR id::text = $1
                 LIMIT 1`,
                [orderRef],
            );

            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            }

            const orderAge = Date.now() - new Date(order.created_at).getTime();
            if (orderAge > 10 * 60 * 1000) {
                return NextResponse.json({ error: 'Order confirmation can only be sent for recent orders' }, { status: 400 });
            }

            await sendOrderConfirmation(payload);
            return NextResponse.json({ success: true, message: 'Order confirmation sent' });
        }

        if (type === 'order_updated') {
            const { order, status } = payload;
            if (!order || !status) {
                return NextResponse.json({ error: 'Missing order or status' }, { status: 400 });
            }
            await sendOrderStatusUpdate(order, status);
            return NextResponse.json({ success: true, message: 'Status update sent' });
        }

        if (type === 'order_status') {
            const { email, name, orderNumber, status, trackingNumber, phone } = payload;

            if (!orderNumber || !status) {
                return NextResponse.json({ error: 'Missing orderNumber or status' }, { status: 400 });
            }

            const fullOrder = await queryOne<{
                id: string
                order_number: string
                guest_email: string | null
                guest_phone: string | null
                shipping_address: unknown
            }>(
                `SELECT id, order_number, guest_email, guest_phone, shipping_address
                 FROM orders
                 WHERE order_number = $1
                 LIMIT 1`,
                [orderNumber],
            );

            const orderData = fullOrder
                ? {
                    ...fullOrder,
                    email: fullOrder.guest_email,
                    phone: fullOrder.guest_phone,
                    metadata: { tracking_number: trackingNumber },
                }
                : {
                    order_number: orderNumber,
                    email,
                    phone,
                    shipping_address: { firstName: name, phone },
                    metadata: { tracking_number: trackingNumber }
                };

            if (!orderData.phone && phone) orderData.phone = phone;

            await sendOrderStatusUpdate(orderData, status);
            return NextResponse.json({ success: true, message: 'Status update sent' });
        }

        if (type === 'welcome') {
            if (!payload.email) {
                return NextResponse.json({ error: 'Missing email' }, { status: 400 });
            }
            await sendWelcomeMessage(payload);
            return NextResponse.json({ success: true, message: 'Welcome message sent' });
        }

        if (type === 'contact') {
            const { name, email, subject, message } = payload;
            if (!name || !email || !subject || !message) {
                return NextResponse.json({ error: 'All contact fields required' }, { status: 400 });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
            }
            if (name.length > 100 || subject.length > 200 || message.length > 5000) {
                return NextResponse.json({ error: 'Input too long' }, { status: 400 });
            }
            await sendContactMessage(payload);
            return NextResponse.json({ success: true, message: 'Contact message sent' });
        }

        if (type === 'payment_link') {
            if (!payload.id || !payload.order_number) {
                return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
            }
            await sendPaymentLink(payload);
            return NextResponse.json({ success: true, message: 'Payment link sent' });
        }

        if (type === 'campaign') {
            const { recipients, subject, message, channels } = payload;

            if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
                return NextResponse.json({ error: 'Recipients required' }, { status: 400 });
            }
            if (!subject || !message) {
                return NextResponse.json({ error: 'Subject and message required' }, { status: 400 });
            }

            const seenPhones = new Set<string>();
            const seenEmails = new Set<string>();
            const results = { email: 0, sms: 0, errors: 0 };
            const safeSubject = escapeHtml(subject);
            const safeMessage = escapeHtml(message);

            for (const recipient of recipients) {
                try {
                    if (channels?.email && recipient.email) {
                        const emailKey = recipient.email.toLowerCase().trim();
                        if (!seenEmails.has(emailKey)) {
                            seenEmails.add(emailKey);
                            const recipientName = escapeHtml(recipient.name || 'Valued Customer');
                            const brandedHtml = emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;text-align:center;">${safeSubject}</h2>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0;">Hi ${recipientName},</p>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">${safeMessage.replace(/\n/g, '</p><p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">')}</p>
`, safeSubject);
                            await sendEmail({ to: recipient.email, subject, html: brandedHtml });
                            results.email++;
                        }
                    }

                    if (channels?.sms && recipient.phone) {
                        const phoneKey = recipient.phone.replace(/[\s\-\(\)\.]+/g, '');
                        if (!seenPhones.has(phoneKey)) {
                            seenPhones.add(phoneKey);
                            await sendSMS({ to: recipient.phone, message });
                            results.sms++;
                        }
                    }
                } catch (err: any) {
                    console.error(`[Campaign] Failed for ${recipient.email || recipient.phone}:`, err.message);
                    results.errors++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Campaign sent: ${results.email} emails, ${results.sms} SMS.${results.errors > 0 ? ` (${results.errors} failed)` : ''}`
            });
        }

        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });

    } catch (error: any) {
        console.error('Notification API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
