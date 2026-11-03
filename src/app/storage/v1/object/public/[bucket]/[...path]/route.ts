import { PUBLIC_BUCKETS, cacheObject, readObject } from "@/lib/db/storage"

/** Only plain media is served inline; anything else downloads, so an upload can't run script on this origin. */
const INLINE_TYPES = /^(image\/(png|jpe?g|webp|gif|avif|x-icon|vnd\.microsoft\.icon)|video\/(mp4|webm)|application\/pdf)$/i

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
  if (!PUBLIC_BUCKETS.has(bucket) || objectPath.endsWith(".meta.json")) {
    return new Response(JSON.stringify({ error: "Object not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
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
  const inline = INLINE_TYPES.test(obj.contentType.split(";")[0].trim())
  return new Response(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": inline ? obj.contentType : "application/octet-stream",
      "Content-Disposition": inline ? "inline" : "attachment",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
