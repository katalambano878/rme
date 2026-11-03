import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  applyPostgrestParams,
  selectReferencedTables,
} from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";
import {
  resolveRequestAuth,
  isStaffAuth,
  staffMayReadTable,
  staffMayWriteTable,
  type RequestAuth,
} from "@/lib/db/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PG_IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Catalog/content tables safe for anonymous storefront reads (RLS replacement). */
const PUBLIC_READ_TABLES = new Set([
  "products",
  "product_images",
  "variants",
  "categories",
  "collections",
  "collection_products",
  "blog_posts",
  "home_content",
  "storefront_settings",
  "reviews",
  "testimonials",
  "occasions",
  "attributes",
  "attribute_values",
]);

/** Columns an anonymous/customer read may touch, for public tables that also hold private settings. */
const PUBLIC_COLUMN_LIMITS: Record<string, Set<string>> = {
  site_settings: new Set(["id", "feature_flags"]),
};

/** Only admins edit profiles; only a superadmin may grant or touch admin/superadmin rows. */
const ADMIN_ONLY_TABLES = new Set(["profiles", "store_admins", "superadmins"]);
/** Sign-up promotes these emails to admin/superadmin, so only a superadmin edits them. */
const SUPERADMIN_ONLY_TABLES = new Set(["store_admins", "superadmins"]);

/** Query keys that are not column filters. */
const NON_FILTER_PARAMS = new Set(["select", "limit", "offset", "columns", "on_conflict"]);

/**
 * Rows anonymous visitors and customers may see in public tables; drafts,
 * hidden reviews and inactive items stay staff-only.
 */
const PUBLIC_ROW_FILTERS: Record<string, [string, string | boolean]> = {
  products: ["status", "active"],
  blog_posts: ["published", true],
  reviews: ["is_published", true],
  testimonials: ["is_active", true],
};
const ELEVATED_ROLES = new Set(["admin", "superadmin"]);

type RestAuth =
  | { ok: true; auth: RequestAuth }
  | { ok: false; status: number; message: string };

function selectedColumns(select: string): string[] {
  return select
    .split(",")
    .map((c) => c.trim().split(":").pop()!.split("::")[0].trim())
    .filter(Boolean);
}

function publicReadAllowed(req: NextRequest, table: string, auth: RequestAuth): boolean {
  const select = req.nextUrl.searchParams.get("select") || "*";

  // A signed-in customer may read their own profile row (login redirect, account page).
  if (table === "profiles" && auth.kind === "user") {
    const idFilter = req.nextUrl.searchParams.get("id");
    return idFilter === `eq.${auth.userId}` && !select.includes("(");
  }

  let tables: string[];
  try {
    tables = selectReferencedTables(select, table);
  } catch {
    return false;
  }
  // Embedded tables must all be public catalog/content tables.
  if (!tables.every((t) => t === table || PUBLIC_READ_TABLES.has(t))) return false;
  if (PUBLIC_READ_TABLES.has(table)) return true;

  const limit = PUBLIC_COLUMN_LIMITS[table];
  if (!limit || select.includes("(") || !selectedColumns(select).every((c) => limit.has(c))) return false;
  // Filters and ordering on hidden columns would leak them one comparison at a time.
  for (const [key, value] of req.nextUrl.searchParams) {
    if (NON_FILTER_PARAMS.has(key)) continue;
    if (key === "or" || key === "and" || key === "not") return false;
    if (key === "order") {
      const cols = value.split(",").map((c) => c.trim().split(".")[0]);
      if (!cols.every((c) => limit.has(c))) return false;
      continue;
    }
    if (!limit.has(key)) return false;
  }
  return true;
}

async function authorizeRest(
  req: NextRequest,
  opts: { write: boolean; table: string },
): Promise<RestAuth> {
  const auth = await resolveRequestAuth(req);
  if (auth.kind === "invalid") {
    return { ok: false, status: 401, message: "Invalid or expired JWT" };
  }
  if (isStaffAuth(auth)) {
    if (opts.write && ADMIN_ONLY_TABLES.has(opts.table) && auth.kind === "user" && !ELEVATED_ROLES.has(auth.role)) {
      return { ok: false, status: 403, message: "Admin role required for this table" };
    }
    if (opts.write && SUPERADMIN_ONLY_TABLES.has(opts.table) && auth.kind === "user" && auth.role !== "superadmin") {
      return { ok: false, status: 403, message: "Superadmin role required for this table" };
    }
    if (!opts.write && !staffMayReadTable(auth, opts.table)) {
      // Everyone may still load their own profile (admin layout, account menu).
      const ownProfile =
        opts.table === "profiles" &&
        auth.kind === "user" &&
        req.nextUrl.searchParams.get("id") === `eq.${auth.userId}`;
      if (!ownProfile) return { ok: false, status: 403, message: "You do not have access to this area" };
    }
    if (opts.write && !staffMayWriteTable(auth, opts.table)) {
      return { ok: false, status: 403, message: "You do not have access to this area" };
    }
    return { ok: true, auth };
  }
  if (opts.write) {
    return {
      ok: false,
      status: auth.kind === "anon" ? 401 : 403,
      message: auth.kind === "anon" ? "Authorization required for writes" : "Staff role required for writes",
    };
  }
  if (publicReadAllowed(req, opts.table, auth)) return { ok: true, auth };
  return {
    ok: false,
    status: auth.kind === "anon" ? 401 : 403,
    message: auth.kind === "anon" ? "Authorization required for this table" : "Not allowed for this table",
  };
}

/**
 * An admin (not superadmin) may only manage customer/staff profiles: they can't
 * promote anyone to admin/superadmin or edit/delete an existing admin.
 */
async function guardProfileWrite(
  req: NextRequest,
  table: string,
  auth: RequestAuth,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE",
): Promise<string | null> {
  if (table !== "profiles" || auth.kind !== "user" || auth.role === "superadmin") return null;
  const rows = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
  for (const row of rows as Record<string, unknown>[]) {
    if (typeof row.role === "string" && ELEVATED_ROLES.has(row.role)) {
      return "Only a superadmin can grant admin roles";
    }
  }
  if (method === "POST") return null;
  const probe = createClient().from(table).select("id, role");
  applyPostgrestParams(probe as any, req.nextUrl.searchParams);
  const { data, error } = await probe;
  if (error) return error.message || "Could not check target rows";
  const targets = (Array.isArray(data) ? data : data ? [data] : []) as { id: string; role: string }[];
  if (targets.some((t) => ELEVATED_ROLES.has(t.role) && t.id !== auth.userId)) {
    return "Only a superadmin can change admin accounts";
  }
  return null;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
}

function preferSingle(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function preferReturn(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("return=representation") || prefer.includes("resolution=");
}

function preferCount(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("count=exact");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { message, code: "PGRST", details: null, hint: null },
    { status, headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const authz = await authorizeRest(req, { write: false, table });
  if (!authz.ok) return jsonError(authz.message, authz.status);

  const client = createClient();
  const qb = client.from(table);
  const select = req.nextUrl.searchParams.get("select") || "*";
  if (preferCount(req)) {
    qb.select(select, {
      count: "exact",
      head: req.headers.get("prefer")?.includes("head=true"),
    });
  } else {
    qb.select(select);
  }
  // Apply filters/order/limit without re-applying select
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.delete("select");
  // Non-staff only ever see published rows, whatever filter they send.
  const rowFilter = isStaffAuth(authz.auth) ? undefined : PUBLIC_ROW_FILTERS[table];
  if (rowFilter) {
    params.delete(rowFilter[0]);
    params.append(rowFilter[0], `eq.${rowFilter[1]}`);
  }
  applyPostgrestParams(qb as any, params, {
    preferSingle: preferSingle(req),
  });

  const result = await qb;
  if (result.error) {
    return jsonError(result.error.message || "Query failed", 400);
  }

  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json");
  if (result.count != null) {
    headers.set("Content-Range", `0-${Math.max((Array.isArray(result.data) ? result.data.length : 1) - 1, 0)}/${result.count}`);
  }

  if (preferSingle(req)) {
    return NextResponse.json(result.data, { status: 200, headers });
  }
  return NextResponse.json(result.data ?? [], { status: 200, headers });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const authz = await authorizeRest(req, { write: true, table });
  if (!authz.ok) return jsonError(authz.message, authz.status);

  const body = await req.json().catch(() => null);
  if (body == null) return jsonError("Invalid JSON body");
  const denied = await guardProfileWrite(req, table, authz.auth, body, "POST");
  if (denied) return jsonError(denied, 403);

  const client = createClient();
  let qb = client.from(table).insert(body);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Insert failed", 400);

  return NextResponse.json(result.data, {
    status: 201,
    headers: corsHeaders(),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const authz = await authorizeRest(req, { write: true, table });
  if (!authz.ok) return jsonError(authz.message, authz.status);

  const body = await req.json().catch(() => null);
  if (body == null || typeof body !== "object") return jsonError("Invalid JSON body");
  const denied = await guardProfileWrite(req, table, authz.auth, body, "PATCH");
  if (denied) return jsonError(denied, 403);

  const client = createClient();
  let qb = client.from(table).update(body);
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Update failed", 400);

  return NextResponse.json(result.data, { status: 200, headers: corsHeaders() });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const authz = await authorizeRest(req, { write: true, table });
  if (!authz.ok) return jsonError(authz.message, authz.status);
  const denied = await guardProfileWrite(req, table, authz.auth, null, "DELETE");
  if (denied) return jsonError(denied, 403);

  const client = createClient();
  let qb = client.from(table).delete();
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req)) {
    qb = qb.select("*") as typeof qb;
  }

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Delete failed", 400);

  return NextResponse.json(result.data ?? null, { status: 200, headers: corsHeaders() });
}
