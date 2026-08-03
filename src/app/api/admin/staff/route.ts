import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAdmin, registerUser } from '@/lib/auth';
import { canManageStaffRoles } from '@/lib/admin-role-access';
import { defaultStaffPermissions, sanitizeStaffPermissions } from '@/lib/staff-permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const gate = await requireManageStaff(request);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status });
    }

    const includeCustomers = request.nextUrl.searchParams.get('includeCustomers') === '1';

    const result = await query(
      includeCustomers
        ? `SELECT id, email, full_name, role, phone, created_at, updated_at, permissions
           FROM profiles ORDER BY full_name ASC NULLS LAST, created_at DESC`
        : `SELECT id, email, full_name, role, created_at, updated_at, permissions
           FROM profiles WHERE role <> 'customer' ORDER BY created_at DESC`,
    );

    return NextResponse.json(result.rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type CallerOk = { ok: true; role: string };
type CallerErr = { ok: false; message: string; status: number };

async function requireManageStaff(request: NextRequest): Promise<CallerOk | CallerErr> {
  const auth = await requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return { ok: false, message: auth.error || 'Unauthorized', status: 401 };
  }
  if (!canManageStaffRoles(auth.role)) {
    return { ok: false, message: 'Forbidden', status: 403 };
  }
  return { ok: true, role: auth.role! };
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

    const created = await registerUser({
      email,
      password,
      full_name: fullName || undefined,
    });

    if (!created.authenticated || !created.user) {
      return NextResponse.json(
        { error: created.error ?? 'Could not create user' },
        { status: 400 },
      );
    }

    const userId = created.user.id;

    try {
      await query(
        `UPDATE public.profiles
         SET role = $2::user_role,
             permissions = $3::jsonb,
             full_name = $4,
             updated_at = now()
         WHERE id = $1`,
        [userId, role, JSON.stringify(permissions), fullName || email.split('@')[0]],
      );
    } catch (upErr) {
      try {
        await query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
      } catch {
        /* best effort rollback */
      }
      const message = upErr instanceof Error ? upErr.message : 'Profile update failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
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

    const target = await queryOne<{ role: string }>(
      `SELECT role::text AS role FROM profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (target?.role === 'superadmin') {
      return NextResponse.json({ error: 'Superadmin accounts cannot be deleted here.' }, { status: 403 });
    }

    try {
      await query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : 'Could not delete user';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
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

    let body: { userId?: string; permissions?: Record<string, boolean>; role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (typeof body.role === 'string' && body.role.trim()) {
      const newRole = body.role.trim();
      if (!['customer', 'staff', 'admin', 'superadmin'].includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      if (newRole === 'admin' && gate.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only a superadmin can assign admin role' }, { status: 403 });
      }
      const target = await queryOne<{ role: string }>(
        `SELECT role::text AS role FROM profiles WHERE id = $1 LIMIT 1`,
        [userId],
      );
      if (target?.role === 'superadmin' && newRole !== 'superadmin') {
        return NextResponse.json({ error: 'Superadmin role cannot be changed here.' }, { status: 403 });
      }
      await query(
        `UPDATE profiles SET role = $2::user_role, updated_at = now() WHERE id = $1`,
        [userId, newRole],
      );
      if (!body.permissions) {
        return NextResponse.json({ ok: true });
      }
    }

    const permissions = sanitizeStaffPermissions(body.permissions ?? {});

    const target = await queryOne<{ role: string }>(
      `SELECT role::text AS role FROM profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (target?.role === 'staff' && !Object.values(permissions).some(Boolean)) {
      return NextResponse.json({ error: 'Select at least one area.' }, { status: 400 });
    }

    try {
      await query(
        `UPDATE profiles SET permissions = $2::jsonb, updated_at = now() WHERE id = $1`,
        [userId, JSON.stringify(permissions)],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
