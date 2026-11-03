import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';
import { isPlainPostgres } from './db/mode';
import { createClient as createPgClient } from './db/supabase-compat';

/**
 * Server-side admin client.
 * - Plain Postgres (DATABASE_URL set): in-process pg compat + auth/storage shims
 * - Otherwise: hosted Supabase service-role client
 *
 * ONLY use in API routes / server actions — never in client components.
 * Lazily constructed so Next.js build/collect does not require env at import time.
 */

function createAdminClient() {
  if (isPlainPostgres()) {
    return createPgClient();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseServiceKey) {
    console.error('CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail');
  }

  return createSupabaseJsClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _client: ReturnType<typeof createAdminClient> | null = null;

function getAdminClient() {
  if (!_client) _client = createAdminClient();
  return _client;
}

// Typed as a supabase-js client: the compat client implements the subset of
// that surface the app calls (see src/lib/supabase/admin.ts).
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = getAdminClient() as object;
      const value = Reflect.get(client, prop, receiver);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  },
) as SupabaseClient;
