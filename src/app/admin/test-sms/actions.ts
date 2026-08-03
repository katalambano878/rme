'use server';

import { verifyAdminToken, verifyAuth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { normalizeSmsRecipient } from '@/lib/sms-debug';

const SMS_ENDPOINT = 'https://api.moolre.com/open/sms/send';

function maskSecret(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (v.length <= 8) return '••••••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function getSmsVasKey(): { key: string | null; source: 'MOOLRE_SMS_API_KEY' | 'MOOLRE_API_KEY' | null } {
  const sms = process.env.MOOLRE_SMS_API_KEY?.trim();
  if (sms) return { key: sms, source: 'MOOLRE_SMS_API_KEY' };
  const fallback = process.env.MOOLRE_API_KEY?.trim();
  if (fallback) return { key: fallback, source: 'MOOLRE_API_KEY' };
  return { key: null, source: null };
}

async function requireAdmin(authToken?: string) {
  if (authToken?.trim()) {
    return verifyAdminToken(authToken);
  }
  const jar = await cookies();
  const cookieHeader = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  if (!cookieHeader) {
    return { authenticated: false as const, error: 'Unauthorized' };
  }
  return verifyAuth(new Request('http://local/auth', { headers: { cookie: cookieHeader } }), {
    requireAdmin: true,
  });
}

export async function getSmsDebuggerStatus(authToken?: string) {
  const auth = await requireAdmin(authToken);
  if (!auth.authenticated) {
    return { ok: false as const, error: auth.error || 'Unauthorized' };
  }

  const { key, source } = getSmsVasKey();

  return {
    ok: true as const,
    endpoint: SMS_ENDPOINT,
    smsVas: {
      configured: Boolean(key),
      source,
      maskedPreview: key ? maskSecret(key) : null,
    },
    moolreEmbed: {
      MOOLRE_API_USER: Boolean(process.env.MOOLRE_API_USER?.trim()),
      MOOLRE_API_PUBKEY: Boolean(process.env.MOOLRE_API_PUBKEY?.trim()),
      MOOLRE_ACCOUNT_NUMBER: Boolean(process.env.MOOLRE_ACCOUNT_NUMBER?.trim()),
      MOOLRE_MERCHANT_EMAIL: Boolean(process.env.MOOLRE_MERCHANT_EMAIL?.trim()),
    },
  };
}

export async function dryRunSmsDebug(phone: string, message: string, authToken?: string) {
  const auth = await requireAdmin(authToken);
  if (!auth.authenticated) {
    return { success: false as const, error: auth.error || 'Unauthorized' };
  }

  if (!phone || typeof phone !== 'string') {
    return { success: false as const, error: 'Phone is required' };
  }
  if (!message || typeof message !== 'string') {
    return { success: false as const, error: 'Message is required' };
  }
  if (message.length > 1000) {
    return { success: false as const, error: 'Message too long (max 1000 characters)' };
  }

  const { recipient, steps, looksValidGh } = normalizeSmsRecipient(phone);
  const senderid = process.env.MOOLRE_SMS_SENDER_ID?.trim() || 'STORE';
  const requestBody = {
    type: 1,
    senderid,
    messages: [{ recipient, message }],
  };

  return {
    success: true as const,
    recipient,
    steps,
    looksValidGh,
    requestBody,
    messageLength: message.length,
  };
}

export async function testSmsAction(phone: string, message: string, authToken?: string) {
  const auth = await requireAdmin(authToken);
  if (!auth.authenticated) {
    return {
      success: false,
      error: 'Unauthorized: ' + (auth.error || 'Admin access required'),
    };
  }

  try {
    const { key: smsVasKey, source: keySource } = getSmsVasKey();

    if (!smsVasKey) {
      return {
        success: false,
        error: 'Missing MOOLRE_SMS_API_KEY or MOOLRE_API_KEY environment variable',
      };
    }

    if (!phone || typeof phone !== 'string') {
      return { success: false, error: 'Invalid phone number' };
    }

    if (!message || typeof message !== 'string' || message.length > 1000) {
      return { success: false, error: 'Invalid or too long message' };
    }

    const { recipient, steps, looksValidGh } = normalizeSmsRecipient(phone);
    const senderid = process.env.MOOLRE_SMS_SENDER_ID?.trim() || 'STORE';

    const requestBody = {
      type: 1,
      senderid,
      messages: [
        {
          recipient,
          message,
        },
      ],
    };

    const started = Date.now();

    const response = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': smsVasKey,
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = Date.now() - started;
    const responseText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { _parseError: true, rawResponse: responseText };
    }

    const body = parsed as Record<string, unknown> | null;
    const apiSuccess = body && typeof body === 'object' && body.status === 1;

    console.log('[SMS Debugger] Sent to', recipient, '| by', auth.user?.email, '| http', response.status);

    return {
      success: Boolean(apiSuccess),
      httpStatus: response.status,
      durationMs,
      formattedPhone: recipient,
      normalization: { steps, looksValidGh },
      keySource: keySource!,
      debug: {
        endpoint: SMS_ENDPOINT,
        request: requestBody,
        note: 'X-API-VASKEY is set server-side; not shown in this payload.',
      },
      result: parsed,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Test SMS] Error:', err.message, err.stack);
    return {
      success: false,
      error: err.message || 'SMS sending failed',
    };
  }
}
