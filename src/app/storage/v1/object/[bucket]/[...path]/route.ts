import { NextRequest, NextResponse } from "next/server"
import { createStorageClient } from "@/lib/db/storage"
import { isPlainPostgres } from "@/lib/db/mode"
import { normalizeUploadImage } from "@/lib/normalize-upload-image"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Supabase Storage upload:
 *   POST /storage/v1/object/{bucket}/{path}
 *   body = raw file bytes
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 })
  }

  const { bucket, path } = await ctx.params
  const objectPath = path.map(decodeURIComponent).join("/")
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true"
  const contentType =
    req.headers.get("content-type") || "application/octet-stream"

  const raw = Buffer.from(await req.arrayBuffer())
  let bytes = raw
  let finalPath = objectPath
  let finalType = contentType

  // Product / public image buckets: force browser-safe formats.
  if (bucket === "product-images" || bucket === "blog-images" || bucket === "uploads") {
    try {
      const normalized = await normalizeUploadImage(raw, objectPath, contentType)
      bytes = normalized.bytes
      finalPath = normalized.objectPath
      finalType = normalized.contentType
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid image"
      return NextResponse.json({ error: { message }, message }, { status: 400 })
    }
  }

  const storage = createStorageClient()
  const { data, error } = await storage.from(bucket).upload(finalPath, bytes, {
    contentType: finalType,
    upsert,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Remove original path if we rewrote the extension (avoid orphan unsupported files).
  if (finalPath !== objectPath) {
    await storage.from(bucket).remove([objectPath]).catch(() => null)
  }

  const { data: pub } = storage.from(bucket).getPublicUrl(finalPath)
  return NextResponse.json({
    Key: `${bucket}/${finalPath}`,
    Id: data?.path ?? finalPath,
    path: finalPath,
    fullPath: `${bucket}/${finalPath}`,
    publicUrl: pub.publicUrl,
  })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 })
  }
  const { bucket, path } = await ctx.params
  const objectPath = path.map(decodeURIComponent).join("/")
  const storage = createStorageClient()
  const { error } = await storage.from(bucket).remove([objectPath])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({})
}
