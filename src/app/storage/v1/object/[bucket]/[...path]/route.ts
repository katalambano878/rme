import { NextRequest, NextResponse } from "next/server"
import { createStorageClient, isValidBucketName } from "@/lib/db/storage"
import { isPlainPostgres } from "@/lib/db/mode"
import { resolveRequestAuth, isStaffAuth } from "@/lib/db/request-auth"
import { normalizeUploadImage } from "@/lib/normalize-upload-image"
import { extractUploadBody } from "@/lib/extract-upload-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Uploads and deletes are admin-only (product, category and blog images). */
async function requireStaff(req: NextRequest): Promise<NextResponse | null> {
  const auth = await resolveRequestAuth(req)
  if (isStaffAuth(auth)) return null
  const message = "Staff session required"
  return NextResponse.json(
    { error: message, message, statusCode: auth.kind === "user" ? "403" : "401" },
    { status: auth.kind === "user" ? 403 : 401 },
  )
}

function guessImageType(objectPath: string): string {
  const ext = objectPath.toLowerCase().split(".").pop() || ""
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  return "image/jpeg"
}

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

  const denied = await requireStaff(req)
  if (denied) return denied

  const { bucket, path } = await ctx.params
  if (!isValidBucketName(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }
  const declared = Number(req.headers.get("content-length") || 0)
  if (declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 })
  }
  const objectPath = path.map(decodeURIComponent).join("/")
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true"
  const contentType =
    req.headers.get("content-type") || "application/octet-stream"

  const body = Buffer.from(await req.arrayBuffer())
  if (body.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 })
  }
  const raw = extractUploadBody(body, contentType)
  let bytes = raw
  let finalPath = objectPath
  // Never let the multipart wrapper's content type reach stored metadata,
  // otherwise the object is later served as multipart/form-data.
  let finalType =
    contentType.includes("multipart/") || contentType === "application/octet-stream"
      ? guessImageType(objectPath)
      : contentType

  // Product / public image buckets: force browser-safe formats.
  if (bucket === "product-images" || bucket === "blog-images" || bucket === "uploads") {
    try {
      const normalized = await normalizeUploadImage(raw, objectPath, finalType)
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
  const denied = await requireStaff(req)
  if (denied) return denied

  const { bucket, path } = await ctx.params
  if (!isValidBucketName(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }
  const objectPath = path.map(decodeURIComponent).join("/")
  const storage = createStorageClient()
  const { error } = await storage.from(bucket).remove([objectPath])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({})
}
