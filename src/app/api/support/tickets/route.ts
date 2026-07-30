import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const search = searchParams.get('search') || '';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) {
    query = query.or(`ticket_number.ilike.%${search}%,subject.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = await req.json();

  const { data: ticketNum, error: ticketNumErr } = await supabaseAdmin.rpc('generate_ticket_number');
  if (ticketNumErr) {
    console.error('[support/tickets] generate_ticket_number failed:', ticketNumErr.message);
  }
  const email = (body.customer_email || body.email || '').trim();
  if (!email || !body.subject) {
    return NextResponse.json({ error: 'subject and customer_email are required' }, { status: 400 });
  }
  const ticket = {
    // Schema: ticket_number is integer; email is NOT NULL.
    ticket_number: typeof ticketNum === 'number' ? ticketNum : Number(ticketNum) || Date.now() % 2_000_000_000,
    subject: body.subject,
    description: body.description || '',
    user_id: body.customer_id || body.user_id || null,
    email,
    customer_email: email,
    customer_name: body.customer_name || '',
    conversation_id: body.conversation_id || null,
    status: body.status || 'open',
    priority: body.priority || 'medium',
    category: body.category || null,
    channel: body.channel || 'manual',
    assigned_to: body.assigned_to || null,
    tags: body.tags || [],
    sla_deadline: body.priority === 'urgent'
      ? new Date(Date.now() + 4 * 3600000).toISOString()
      : body.priority === 'high'
        ? new Date(Date.now() + 8 * 3600000).toISOString()
        : new Date(Date.now() + 24 * 3600000).toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert(ticket)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.initial_message) {
    await supabaseAdmin.from('support_messages').insert({
      ticket_id: data.id,
      message: body.initial_message,
      is_internal: body.message_sender_type === 'staff' || body.message_sender_type === 'system',
      user_id: auth.user?.id || null,
    });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });

  if (updates.status === 'resolved' && !updates.resolved_at) {
    updates.resolved_at = new Date().toISOString();
  }
  if (updates.status === 'closed' && !updates.closed_at) {
    updates.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
