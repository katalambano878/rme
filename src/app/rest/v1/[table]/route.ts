import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  applyPostgrestParams,
} from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";
import { verifyAccessToken } from "@/lib/db/auth";

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
  "site_settings",
  "storefront_settings",
  "reviews",
  "testimonials",
  "occasions",
  "discounts",
  "attributes",
  "attribute_values",
]);

type RestAuth =
  | { ok: true; role: string | null; service: boolean }
  | { ok: false; status: number; message: string };

async function authorizeRest(
  req: NextRequest,
  opts: { write: boolean; table: string },
): Promise<RestAuth> {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const apikey = req.headers.get("apikey")?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (serviceKey && (bearer === serviceKey || apikey === serviceKey)) {
    return { ok: true, role: "service", service: true };
  }

  if (bearer) {
    const verified = await verifyAccessToken(bearer);
    if (!verified) {
      return { ok: false, status: 401, message: "Invalid or expired JWT" };
    }
    const role =
      (verified.payload.app_metadata as { role?: string } | undefined)?.role ||
      null;
    const staff = role === "admin" || role === "staff" || role === "superadmin";
    if (opts.write && !staff) {
      return { ok: false, status: 403, message: "Staff role required for writes" };
    }
    if (!opts.write && !PUBLIC_READ_TABLES.has(opts.table) && !staff) {
      // Authenticated customers may read non-public tables only if staff for now
      // (customer order history uses dedicated API routes, not open REST).
      return { ok: false, status: 403, message: "Not allowed for this table" };
    }
    return { ok: true, role, service: false };
  }

  // Anonymous storefront reads for catalog/content tables only
  if (!opts.write && PUBLIC_READ_TABLES.has(opts.table)) {
    return { ok: true, role: null, service: false };
  }

  return {
    ok: false,
    status: 401,
    message: opts.write
      ? "Authorization required for writes"
      : "Authorization required for this table",
  };
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
