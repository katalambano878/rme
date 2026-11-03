// Who is calling a shim route (/rest/v1, /storage/v1)?
//
// The JWT says which user it is; the role always comes from `profiles`, so a
// demoted or deleted staff member loses access at once instead of keeping it
// until their 7-day token expires.

import { query } from "./pool";
import { verifyAccessToken } from "./auth";

export const STAFF_ROLES = new Set(["staff", "admin", "superadmin"]);

export type RequestAuth =
  | { kind: "service"; userId: null; role: "service" }
  | {
      kind: "user";
      userId: string;
      role: string;
      staff: boolean;
      permissions: Record<string, unknown>;
    }
  | { kind: "anon"; userId: null; role: null }
  | { kind: "invalid"; userId: null; role: null };

function bearerFrom(req: Request): string {
  const header = req.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

export async function resolveRequestAuth(req: Request): Promise<RequestAuth> {
  const bearer = bearerFrom(req);
  const apikey = req.headers.get("apikey")?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (serviceKey && serviceKey.length >= 20 && (bearer === serviceKey || apikey === serviceKey)) {
    return { kind: "service", userId: null, role: "service" };
  }

  // supabase-js sends the anon key as the bearer when nobody is signed in.
  if (!bearer || bearer === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { kind: "anon", userId: null, role: null };
  }

  const verified = await verifyAccessToken(bearer);
  if (!verified) return { kind: "invalid", userId: null, role: null };

  const { rows } = await query<{ role: string | null; permissions: unknown }>(
    `SELECT p.role, p.permissions
       FROM auth.users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      LIMIT 1`,
    [verified.userId],
  ).catch(() => ({ rows: [] as { role: string | null; permissions: unknown }[], rowCount: 0 }));
  if (!rows[0]) return { kind: "invalid", userId: null, role: null };

  const role = rows[0].role || "customer";
  const permissions =
    rows[0].permissions && typeof rows[0].permissions === "object"
      ? (rows[0].permissions as Record<string, unknown>)
      : {};
  return { kind: "user", userId: verified.userId, role, staff: STAFF_ROLES.has(role), permissions };
}

/**
 * Admin areas (profiles.permissions keys) that may write each table. A staff
 * member needs at least one of them; tables not listed are open to all staff.
 * Admins, superadmins and staff with no flags saved yet pass, matching the
 * admin sidebar's rules in staff-permissions.ts. An empty list means admins only.
 */
const TABLE_WRITE_AREAS: Record<string, string[]> = {
  products: ["products", "inventory", "sales", "pos", "orders"],
  variants: ["products", "inventory", "sales", "pos", "orders"],
  product_images: ["products"],
  inventory_movements: ["products", "inventory", "pos", "orders"],
  categories: ["categories", "products"],
  collections: ["products", "categories"],
  collection_products: ["products", "categories"],
  discounts: ["coupons", "sales"],
  site_settings: ["sales", "modules"],
  storefront_settings: ["modules"],
  store_modules: ["modules"],
  home_content: ["modules"],
  orders: ["orders", "pos"],
  order_items: ["orders", "pos"],
  payments: ["orders", "pos"],
  shipments: ["orders"],
  returns: ["orders"],
  blog_posts: ["blog"],
  reviews: ["reviews"],
  support_tickets: ["support"],
  support_messages: ["support"],
  support_knowledge_base: ["support"],
  chat_conversations: ["support"],
  support_feedback: ["support"],
  ai_memory: ["support"],
  customer_insights: ["customer_insights"],
  addresses: ["orders", "customers"],
  // Admin-only for the staff role, whatever its flags say.
  webhook_logs: [],
  login_audit_log: [],
  carts: [],
  cart_items: [],
  wishlists: [],
};

/**
 * Areas that may READ tables holding customer or payment data. Catalogue and
 * content tables aren't listed: any staff member may read them. Each list
 * covers every admin page that loads the table (see staff-permissions.ts).
 */
const TABLE_READ_AREAS: Record<string, string[]> = {
  orders: ["orders", "pos", "analytics", "customers", "customer_insights", "dashboard", "products"],
  order_items: ["orders", "pos", "analytics", "customers", "dashboard", "products", "inventory"],
  payments: ["orders", "pos"],
  shipments: ["orders"],
  returns: ["orders"],
  addresses: ["orders", "customers"],
  profiles: ["customers", "customer_insights", "notifications", "pos", "support", "orders"],
  discounts: ["coupons", "sales", "pos", "orders"],
  chat_conversations: ["support"],
  ai_memory: ["support"],
  support_tickets: ["support"],
  support_messages: ["support"],
  support_feedback: ["support"],
  customer_insights: ["customer_insights"],
  inventory_movements: ["inventory", "products", "orders", "pos"],
  carts: ["customers", "customer_insights", "analytics"],
  cart_items: ["customers", "customer_insights", "analytics"],
  wishlists: ["customers", "customer_insights", "analytics"],
  webhook_logs: [],
  login_audit_log: [],
  store_admins: [],
  superadmins: [],
};

function staffAreaAllows(auth: RequestAuth, areas: string[] | undefined): boolean {
  if (auth.kind === "service") return true;
  if (auth.kind !== "user" || !auth.staff) return false;
  if (auth.role !== "staff") return true;
  if (!areas) return true;
  if (areas.length === 0) return false;
  if (Object.keys(auth.permissions).length === 0) return true;
  return areas.some((a) => auth.permissions[a] === true);
}

export function staffMayReadTable(auth: RequestAuth, table: string): boolean {
  return staffAreaAllows(auth, TABLE_READ_AREAS[table]);
}

export function staffMayWriteTable(auth: RequestAuth, table: string): boolean {
  return staffAreaAllows(auth, TABLE_WRITE_AREAS[table]);
}

export function isStaffAuth(auth: RequestAuth): boolean {
  return auth.kind === "service" || (auth.kind === "user" && auth.staff);
}
