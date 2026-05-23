import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const clientIp = getClientIdentifier(req);
  const limit = checkRateLimit(`feedback:${clientIp}`, { maxRequests: 10, windowSeconds: 60 * 60 });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many feedback submissions.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id.slice(0, 64) : null;
  const ticketId = typeof body?.ticket_id === 'string' ? body.ticket_id.slice(0, 64) : null;

  // SECURITY: must reference an existing conversation or ticket so a stranger
  // can't spam arbitrary feedback rows.
  if (!conversationId && !ticketId) {
    return NextResponse.json({ error: 'conversation_id or ticket_id required' }, { status: 400 });
  }

  // Require referenced row to actually exist
  if (conversationId) {
    const { data: convo } = await supabaseAdmin
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!convo) return NextResponse.json({ error: 'Unknown conversation' }, { status: 404 });
  }
  if (ticketId) {
    const { data: ticket } = await supabaseAdmin
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket) return NextResponse.json({ error: 'Unknown ticket' }, { status: 404 });
  }

  const ratingNum = Number(body?.rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'rating must be an integer 1–5' }, { status: 400 });
  }

  const customerEmail =
    typeof body?.customer_email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email)
      ? body.customer_email.slice(0, 200)
      : null;

  const feedbackText =
    typeof body?.feedback_text === 'string' ? body.feedback_text.slice(0, 2000) : null;

  const feedbackCategories = Array.isArray(body?.feedback_categories)
    ? body.feedback_categories
        .filter((c: unknown) => typeof c === 'string')
        .slice(0, 10)
        .map((c: string) => c.slice(0, 50))
    : [];

  // SECURITY: NEVER trust client-supplied customer_id — it would let one user
  // attribute feedback to another user's account. The DB will derive it from
  // the conversation/ticket on the server side via a future trigger; for now,
  // store null.
  const { data, error } = await supabaseAdmin
    .from('support_feedback')
    .insert({
      conversation_id: conversationId,
      ticket_id: ticketId,
      customer_id: null,
      customer_email: customerEmail,
      rating: ratingNum,
      feedback_text: feedbackText,
      feedback_categories: feedbackCategories,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('support_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
