import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canManageStaffRoles } from '@/lib/admin-role-access';
import { defaultStaffPermissions, sanitizeStaffPermissions } from '@/lib/staff-permissions';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CallerOk = { ok: true; role: string };
type CallerErr = { ok: false; message: string; status: number };

async function requireManageStaff(request: NextRequest): Promise<CallerOk | CallerErr> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { ok: false, message: 'Unauthorized', status: 401 };

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);
  if (userErr || !user) return { ok: false, message: 'Unauthorized', status: 401 };

  const { data: profile, error: profErr } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profErr || !profile?.role) return { ok: false, message: 'Unauthorized', status: 401 };
  if (!canManageStaffRoles(profile.role)) return { ok: false, message: 'Forbidden', status: 403 };

  return { ok: true, role: profile.role as string };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireManageStaff(request);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status });
    }
    const callerRole = gate.role;

    let body: {
      email?: string;
      password?: string;
      fullName?: string;
      role?: string;
      permissions?: Record<string, boolean>;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    let role = typeof body.role === 'string' ? body.role.trim() : 'staff';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
    }

    if (!['staff', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (role === 'admin' && callerRole !== 'superadmin') {
      return NextResponse.json({ error: 'Only a superadmin can create admin accounts' }, { status: 403 });
    }

    const permissions =
      body.permissions && typeof body.permissions === 'object'
        ? sanitizeStaffPermissions(body.permissions)
        : defaultStaffPermissions();

    if (role === 'staff' && !Object.values(permissions).some(Boolean)) {
      return NextResponse.json({ error: 'Select at least one area the staff member can access.' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Could not create user' },
        { status: 400 },
      );
    }

    const userId = created.user.id;

    const { error: upErr } = await admin
      .from('profiles')
      .update({
        role,
        permissions,
        full_name: fullName || email.split('@')[0],
      })
      .eq('id', userId);

    if (upErr) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { error: 'Server is not configured for staff creation (missing service role key).' },
        { status: 503 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireManageStaff(request);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status });
    }

    let body: { userId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (target?.role === 'superadmin') {
      return NextResponse.json({ error: 'Superadmin accounts cannot be deleted here.' }, { status: 403 });
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured (missing service role key).' }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireManageStaff(request);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status });
    }

    let body: { userId?: string; permissions?: Record<string, boolean> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const permissions = sanitizeStaffPermissions(body.permissions ?? {});

    const admin = supabaseAdmin;
    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (target?.role === 'staff' && !Object.values(permissions).some(Boolean)) {
      return NextResponse.json({ error: 'Select at least one area.' }, { status: 400 });
    }

    const { error } = await admin.from('profiles').update({ permissions }).eq('id', userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server is not configured (missing service role key).' }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

