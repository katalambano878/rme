import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireStaffArea } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Optional second lock on the Modules page. The PIN lives in MODULES_PIN on
 * the server; it used to be hard-coded in the page, where anyone could read
 * it from the JavaScript bundle. Unset means no PIN (the Modules area
 * permission still applies).
 */
function configuredPin(): string {
  return (process.env.MODULES_PIN || '').trim();
}

async function gate(request: NextRequest) {
  const auth = await requireStaffArea(request, 'modules');
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await gate(request);
  if (denied) return denied;
  return NextResponse.json({ pinRequired: configuredPin().length > 0 });
}

export async function POST(request: NextRequest) {
  const denied = await gate(request);
  if (denied) return denied;

  const limited = checkRateLimit(`modules-pin:${getClientIdentifier(request)}`, RATE_LIMITS.loginEmail);
  if (!limited.success) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const expected = configuredPin();
  if (!expected) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
  const given = Buffer.from(typeof body.pin === 'string' ? body.pin : '');
  const want = Buffer.from(expected);
  const ok = given.length === want.length && timingSafeEqual(given, want);
  if (!ok) return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  return NextResponse.json({ ok: true });
}
