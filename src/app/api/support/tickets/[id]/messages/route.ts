import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const message = (body.message || body.content || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .insert({
      ticket_id: id,
      message,
      is_internal: !!body.is_internal,
      user_id: auth.user?.id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
