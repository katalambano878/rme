import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { canAccessAdminPanel } from './admin-role-access';

/**
 * Shared server-side authentication utilities.
 * Use these in API routes and server actions to verify callers.
 */

export interface AuthResult {
    authenticated: boolean;
    user?: any;
    role?: string;
    error?: string;
}

/**
 * Extract the Supabase access token from the request.
 * Checks cookies first (set by admin login), then Authorization header.
 */
function extractToken(req: NextRequest | Request): string | undefined {
    // An explicit Authorization header wins: a stale admin cookie must not
    // override the session the caller is actually sending.
    const authHeader = req.headers.get('authorization');
    let token: string | undefined = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;
    if (token) return token;

    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
        const nr = req as NextRequest;
        token = nr.cookies.get('sb-access-token')?.value;

        if (!token) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
            if (projectRef) {
                const raw = nr.cookies.get(`sb-${projectRef}-auth-token`)?.value;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed[0]) token = parsed[0];
                        else if (typeof parsed === 'object' && parsed && 'access_token' in parsed) token = (parsed as { access_token?: string }).access_token;
                        else if (typeof parsed === 'string') token = parsed;
                    } catch {
                        token = raw;
                    }
                }
            }
        }
    }

    return token;
}

/**
 * Authenticate an API request and require admin/staff role.
 * Works with cookie-based admin sessions and Bearer tokens.
 */
export async function requireAdmin(req: NextRequest | Request): Promise<AuthResult> {
    const token = extractToken(req);
    if (!token) {
        return { authenticated: false, error: 'Not authenticated' };
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return { authenticated: false, error: 'Invalid or expired session' };
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !canAccessAdminPanel(profile.role)) {
            return { authenticated: false, error: 'Admin access required' };
        }

        return { authenticated: true, user, role: profile.role };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Auth failed';
        return { authenticated: false, error: message };
    }
}

/**
 * Verify that the request has a valid Supabase session
 * and optionally check for admin/staff role.
 */
export async function verifyAuth(
    request: Request,
    options: { requireAdmin?: boolean } = {}
): Promise<AuthResult> {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        return { authenticated: false, error: 'Missing authorization token' };
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return { authenticated: false, error: 'Invalid or expired token' };
        }

        if (options.requireAdmin) {
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                return { authenticated: false, error: 'Could not verify user role' };
            }

            if (!canAccessAdminPanel(profile.role)) {
                return { authenticated: false, error: 'Admin access required' };
            }

            return { authenticated: true, user, role: profile.role };
        }

        return { authenticated: true, user };
    } catch (err: any) {
        return { authenticated: false, error: err.message || 'Auth verification failed' };
    }
}

/**
 * Verify admin auth for server actions.
 * Requires passing the auth token from the client.
 */
export async function verifyAdminToken(token: string): Promise<AuthResult> {
    if (!token) {
        return { authenticated: false, error: 'Missing token' };
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return { authenticated: false, error: 'Invalid or expired token' };
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return { authenticated: false, error: 'Could not verify role' };
        }

        if (!canAccessAdminPanel(profile.role)) {
            return { authenticated: false, error: 'Admin access required' };
        }

        return { authenticated: true, user, role: profile.role };
    } catch (err: any) {
        return { authenticated: false, error: err.message || 'Auth failed' };
    }
}

/**
 * Like requireAdmin, but a `staff` member must also have the area switched on
 * in profiles.permissions (the same flags the admin sidebar uses). Admins and
 * superadmins pass every area. Pass `adminOnly` for areas staff never get.
 */
export async function requireStaffArea(
    req: NextRequest | Request,
    area: string,
    options: { adminOnly?: boolean } = {}
): Promise<AuthResult> {
    const auth = await requireAdmin(req);
    if (!auth.authenticated) return auth;
    if (auth.role === 'admin' || auth.role === 'superadmin') return auth;
    if (options.adminOnly) {
        return { authenticated: false, error: 'Admin access required' };
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('permissions')
        .eq('id', auth.user.id)
        .maybeSingle();
    const permissions = (profile?.permissions || {}) as Record<string, unknown>;
    // Matches staffCanAccessPath: a staff row with no flags saved yet has every area.
    if (Object.keys(permissions).length === 0 || permissions[area] === true) return auth;
    return { authenticated: false, error: 'You do not have access to this area' };
}

/** Server-action variant of requireStaffArea (token passed from the client). */
export async function verifyStaffAreaToken(
    token: string,
    area: string,
    options: { adminOnly?: boolean } = {}
): Promise<AuthResult> {
    return requireStaffArea(
        new Request('http://internal/', { headers: { authorization: `Bearer ${token}` } }),
        area,
        options
    );
}
