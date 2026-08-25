import { cacheObject, readObject } from "@/lib/db/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function legacyStorageOrigin(): string | null {
  const raw =
    process.env.LEGACY_SUPABASE_URL || process.env.LEGACY_STORAGE_ORIGIN || ""
  const trimmed = raw.trim().replace(/\/+$/, "")
  return trimmed || null
}

async function fetchLegacy(
  bucket: string,
  objectPath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const legacy = legacyStorageOrigin()
  if (!legacy) return null
  const remote = `${legacy}/storage/v1/object/public/${bucket}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`
  try {
    const res = await fetch(remote, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    const contentType =
      res.headers.get("content-type") || "application/octet-stream"
    await cacheObject(bucket, objectPath, bytes, contentType)
    return { bytes, contentType }
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
): Promise<Response> {
  const { bucket, path: parts } = await ctx.params
  const objectPath = parts.map(decodeURIComponent).join("/")
  let obj = await readObject(bucket, objectPath)
  if (!obj) {
    obj = await fetchLegacy(bucket, objectPath)
  }
  if (!obj) {
    return new Response(JSON.stringify({ error: "Object not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    })
  }
  return new Response(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
