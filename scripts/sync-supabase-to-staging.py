#!/usr/bin/env python3
"""Sync lagging RME tables from live Supabase -> fleet-postgres rme_staging.

Upserts by primary key (id). Never deletes staging-only rows.
Only writes columns that exist on staging.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Sequence

REF = "warrbuvcybwskhzzrgqi"
BASE = f"https://{REF}.supabase.co/rest/v1"
DB = "rme_staging"
PAGE = 1000

TABLES = [
    "categories",
    "products",
    "variants",
    "product_images",
    "orders",
    "order_items",
    "payments",
    "chat_conversations",
]


def run_psql(sql: str) -> str:
    cmd = [
        "docker",
        "exec",
        "-i",
        "fleet-postgres",
        "psql",
        "-U",
        "postgres",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-t",
        "-A",
        "-c",
        sql,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql failed:\n{r.stderr}\nSQL={sql[:400]}")
    return r.stdout


def get_service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if key:
        return key
    cid = subprocess.check_output(
        "docker ps --format '{{.Names}}' | grep x1m0wke | head -1",
        shell=True,
        text=True,
    ).strip()
    if not cid:
        raise RuntimeError("Could not find rme-staging container")
    key = subprocess.check_output(
        ["docker", "exec", cid, "printenv", "SUPABASE_SERVICE_ROLE_KEY"],
        text=True,
    ).strip()
    if not key:
        raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")
    return key


def staging_columns(table: str) -> List[str]:
    out = run_psql(
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name='{table}' "
        "ORDER BY ordinal_position;"
    )
    cols = [c.strip() for c in out.splitlines() if c.strip()]
    if not cols:
        raise RuntimeError(f"No columns for {table} on staging")
    return cols


def staging_column_types(table: str) -> Dict[str, str]:
    """Return map column_name -> udt_name (e.g. jsonb, _text, uuid)."""
    out = run_psql(
        "SELECT column_name || '=' || udt_name FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name='{table}';"
    )
    types: Dict[str, str] = {}
    for line in out.splitlines():
        line = line.strip()
        if "=" in line:
            k, v = line.split("=", 1)
            types[k] = v
    return types


def fetch_table(key: str, table: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    start = 0
    while True:
        end = start + PAGE - 1
        req = urllib.request.Request(
            f"{BASE}/{table}?select=*",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Range": f"{start}-{end}",
                "Prefer": "count=exact",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                chunk = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:400]
            raise RuntimeError(f"Supabase {table}: HTTP {e.code} {body}") from e
        if not isinstance(chunk, list):
            raise RuntimeError(f"Unexpected response for {table}")
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        start += PAGE
    return rows


def sql_ident(name: str) -> str:
    if not name.replace("_", "").isalnum():
        raise ValueError(f"unsafe ident: {name}")
    return f'"{name}"'


def pg_text_array(v: Any) -> str:
    if v is None:
        return r"\N"
    if not isinstance(v, list):
        v = [v]
    parts = []
    for item in v:
        if item is None:
            parts.append("NULL")
            continue
        s = str(item).replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'"{s}"')
    return "{" + ",".join(parts) + "}"


def to_copy_value(v: Any, udt: str = "") -> str:
    if v is None:
        return r"\N"
    if isinstance(v, bool):
        return "t" if v else "f"
    # Postgres text[] / other arrays â€” JSON list must become {a,b}
    if udt.startswith("_") or udt.endswith("[]"):
        if isinstance(v, str):
            # already a PG array literal?
            if v.startswith("{") and v.endswith("}"):
                s = v
            else:
                try:
                    parsed = json.loads(v)
                    return pg_text_array(parsed)
                except Exception:
                    s = v
            return (
                s.replace("\\", "\\\\")
                .replace("\t", "\\t")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
            )
        return pg_text_array(v)
    if isinstance(v, (dict, list)):
        s = json.dumps(v, separators=(",", ":"), ensure_ascii=False)
    elif isinstance(v, (int, float)):
        return str(v)
    else:
        s = str(v)
    return (
        s.replace("\\", "\\\\")
        .replace("\t", "\\t")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )


def upsert_table(
    table: str,
    cols: Sequence[str],
    rows: List[Dict[str, Any]],
    col_types: Optional[Dict[str, str]] = None,
) -> None:
    if not rows:
        print(f"  {table}: 0 rows from Supabase")
        return

    col_types = col_types or {}
    col_list = ", ".join(sql_ident(c) for c in cols)
    tmp = f"_sync_tmp_{table}"
    updates = [c for c in cols if c != "id"]
    set_clause = ", ".join(f"{sql_ident(c)}=EXCLUDED.{sql_ident(c)}" for c in updates)
    if not set_clause:
        set_clause = f"{sql_ident('id')}=EXCLUDED.{sql_ident('id')}"

    copy_body = "\n".join(
        "\t".join(to_copy_value(r.get(c), col_types.get(c, "")) for c in cols)
        for r in rows
    ) + "\n"

    # Tables with alternate unique keys that can diverge from id.
    if table == "categories":
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp} t
WHERE NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.id = t.id)
  AND (
    t.slug IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.slug = t.slug)
  );
UPDATE public.{table} p
SET {", ".join(f"{sql_ident(c)}=t.{sql_ident(c)}" for c in updates)}
FROM {tmp} t
WHERE p.id = t.id;
"""
    elif table == "chat_conversations":
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp} t
WHERE NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.session_id = t.session_id);
UPDATE public.{table} p
SET {", ".join(f"{sql_ident(c)}=t.{sql_ident(c)}" for c in updates)}
FROM {tmp} t
WHERE p.id = t.id
   OR (p.session_id = t.session_id AND p.id <> t.id);
"""
    elif table == "orders":
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp} t
WHERE NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.order_number = t.order_number);
UPDATE public.{table} p
SET {", ".join(f"{sql_ident(c)}=t.{sql_ident(c)}" for c in updates)}
FROM {tmp} t
WHERE p.id = t.id
   OR (p.order_number = t.order_number AND p.id <> t.id);
"""
    elif table == "variants":
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp} t
WHERE NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.id = t.id)
  AND (
    t.sku IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.sku = t.sku)
  );
UPDATE public.{table} p
SET {", ".join(f"{sql_ident(c)}=t.{sql_ident(c)}" for c in updates)}
FROM {tmp} t
WHERE p.id = t.id
   OR (t.sku IS NOT NULL AND p.sku = t.sku AND p.id <> t.id);
"""
    elif table == "payments":
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp} t
WHERE NOT EXISTS (SELECT 1 FROM public.{table} p WHERE p.id = t.id)
  AND (
    t.provider_ref IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.{table} p
      WHERE p.provider = t.provider AND p.provider_ref = t.provider_ref
    )
  );
UPDATE public.{table} p
SET {", ".join(f"{sql_ident(c)}=t.{sql_ident(c)}" for c in updates)}
FROM {tmp} t
WHERE p.id = t.id
   OR (
     t.provider_ref IS NOT NULL
     AND p.provider = t.provider
     AND p.provider_ref = t.provider_ref
     AND p.id <> t.id
   );
"""
    else:
        insert_sql = f"""
INSERT INTO public.{table} ({col_list})
SELECT {col_list} FROM {tmp}
ON CONFLICT (id) DO UPDATE SET {set_clause};
"""

    script = f"""BEGIN;
CREATE TEMP TABLE {tmp} (LIKE public.{table} INCLUDING DEFAULTS) ON COMMIT DROP;
COPY {tmp} ({col_list}) FROM STDIN WITH (FORMAT text, NULL '\\N');
{copy_body}\\.
{insert_sql}
COMMIT;
SELECT COUNT(*) FROM public.{table};
"""
    cmd = [
        "docker",
        "exec",
        "-i",
        "fleet-postgres",
        "psql",
        "-U",
        "postgres",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-t",
        "-A",
    ]
    r = subprocess.run(cmd, input=script, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(
            f"upsert {table} failed:\nSTDERR:\n{r.stderr}\nSTDOUT:\n{r.stdout[-800:]}"
        )
    count = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else "?"
    print(f"  {table}: upserted {len(rows)}; staging count={count}")


def build_category_id_map(sb_categories: List[Dict[str, Any]]) -> Dict[str, str]:
    """Map Supabase category id -> staging category id (by id match or slug)."""
    out = run_psql("SELECT id::text || '|' || COALESCE(slug,'') FROM categories;")
    staging_by_slug: Dict[str, str] = {}
    staging_ids = set()
    for line in out.splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        sid, slug = line.split("|", 1)
        staging_ids.add(sid)
        if slug:
            staging_by_slug[slug] = sid

    remap: Dict[str, str] = {}
    for c in sb_categories:
        sb_id = str(c.get("id"))
        slug = c.get("slug") or ""
        if sb_id in staging_ids:
            remap[sb_id] = sb_id
        elif slug in staging_by_slug:
            remap[sb_id] = staging_by_slug[slug]
            print(f"  category remap {slug}: {sb_id} -> {staging_by_slug[slug]}")
        else:
            remap[sb_id] = sb_id  # will be inserted
    return remap


def build_variant_id_map(sb_variants: List[Dict[str, Any]]) -> Dict[str, str]:
    out = run_psql("SELECT id::text || '|' || COALESCE(sku,'') FROM variants;")
    by_sku: Dict[str, str] = {}
    ids = set()
    for line in out.splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        vid, sku = line.split("|", 1)
        ids.add(vid)
        if sku:
            by_sku[sku] = vid
    remap: Dict[str, str] = {}
    for v in sb_variants:
        sb_id = str(v.get("id"))
        sku = v.get("sku") or ""
        if sb_id in ids:
            remap[sb_id] = sb_id
        elif sku in by_sku:
            remap[sb_id] = by_sku[sku]
        else:
            remap[sb_id] = sb_id
    return remap


def build_order_id_map(sb_orders: List[Dict[str, Any]]) -> Dict[str, str]:
    out = run_psql("SELECT id::text || '|' || order_number FROM orders;")
    by_number: Dict[str, str] = {}
    ids = set()
    for line in out.splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        oid, num = line.split("|", 1)
        ids.add(oid)
        if num:
            by_number[num] = oid
    remap: Dict[str, str] = {}
    for o in sb_orders:
        sb_id = str(o.get("id"))
        num = o.get("order_number") or ""
        if sb_id in ids:
            remap[sb_id] = sb_id
        elif num in by_number:
            remap[sb_id] = by_number[num]
        else:
            remap[sb_id] = sb_id
    return remap


def main() -> int:
    print(f"Syncing Supabase {REF} -> {DB}")
    key = get_service_key()
    category_remap: Dict[str, str] = {}
    order_remap: Dict[str, str] = {}
    variant_remap: Dict[str, str] = {}
    sb_variants_cache: List[Dict[str, Any]] = []

    for table in TABLES:
        cols = staging_columns(table)
        col_types = staging_column_types(table)
        print(f"Fetching {table} ({len(cols)} cols)...")
        rows = fetch_table(key, table)
        print(f"  supabase rows: {len(rows)}")
        if table == "categories":
            rows.sort(key=lambda r: (r.get("parent_id") is not None, str(r.get("id"))))
            parents = [r for r in rows if not r.get("parent_id")]
            children = [r for r in rows if r.get("parent_id")]
            upsert_table(table, cols, parents, col_types)
            category_remap = build_category_id_map(rows)
            for r in children:
                pid = r.get("parent_id")
                if pid and str(pid) in category_remap:
                    r["parent_id"] = category_remap[str(pid)]
            upsert_table(table, cols, children, col_types)
            category_remap = build_category_id_map(rows)
            continue

        if table == "products" and category_remap:
            for r in rows:
                cid = r.get("category_id")
                if cid and str(cid) in category_remap:
                    r["category_id"] = category_remap[str(cid)]

        if table == "variants":
            sb_variants_cache = rows
            upsert_table(table, cols, rows, col_types)
            variant_remap = build_variant_id_map(rows)
            remapped = sum(1 for a, b in variant_remap.items() if a != b)
            print(f"  variant id remaps: {remapped}")
            continue

        if table == "orders":
            upsert_table(table, cols, rows, col_types)
            order_remap = build_order_id_map(rows)
            remapped = sum(1 for a, b in order_remap.items() if a != b)
            print(f"  order id remaps: {remapped}")
            continue

        if table in ("order_items", "payments") and order_remap:
            for r in rows:
                oid = r.get("order_id")
                if oid and str(oid) in order_remap:
                    r["order_id"] = order_remap[str(oid)]
        if table == "order_items" and variant_remap:
            for r in rows:
                vid = r.get("variant_id")
                if vid and str(vid) in variant_remap:
                    r["variant_id"] = variant_remap[str(vid)]

        upsert_table(table, cols, rows, col_types)

    print("\n=== POST-SYNC COUNTS ===")
    print(
        run_psql(
            """
SELECT 'products' t, count(*)::text c FROM products
UNION ALL SELECT 'variants', count(*)::text FROM variants
UNION ALL SELECT 'product_images', count(*)::text FROM product_images
UNION ALL SELECT 'orders', count(*)::text FROM orders
UNION ALL SELECT 'order_items', count(*)::text FROM order_items
UNION ALL SELECT 'payments', count(*)::text FROM payments
UNION ALL SELECT 'categories', count(*)::text FROM categories
UNION ALL SELECT 'chat_conversations', count(*)::text FROM chat_conversations
ORDER BY 1;
"""
        )
    )
    print("=== FRESHNESS ===")
    print(
        run_psql(
            """
SELECT 'products_max_updated', COALESCE(max(updated_at)::text,'null') FROM products
UNION ALL
SELECT 'orders_max_created', COALESCE(max(created_at)::text,'null') FROM orders;
"""
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
