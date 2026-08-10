import sharp from "sharp"

const SAFE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"])

export type NormalizedUpload = {
  bytes: Buffer
  objectPath: string
  contentType: string
}

function extOf(objectPath: string): string {
  return (objectPath.split(".").pop() || "").toLowerCase()
}

function guessContentType(ext: string): string {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  return "application/octet-stream"
}

/**
 * Ensure uploaded bytes are a browser + sharp-friendly image.
 * Converts HEIC/JXL/AVIF/etc (when sharp can decode) to JPEG.
 */
export async function normalizeUploadImage(
  bytes: Buffer,
  objectPath: string,
  contentType?: string | null,
): Promise<NormalizedUpload> {
  const ext = extOf(objectPath)
  try {
    const meta = await sharp(bytes, { failOn: "none" }).metadata()
    if (!meta.format) {
      throw new Error("unreadable")
    }

    if (SAFE_EXT.has(ext) && ["jpeg", "png", "webp", "gif"].includes(meta.format)) {
      return {
        bytes,
        objectPath,
        contentType: contentType || guessContentType(ext),
      }
    }

    const converted = await sharp(bytes, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    const base = objectPath.replace(/\.[^.]+$/i, "") || objectPath
    return {
      bytes: converted,
      objectPath: `${base}.jpeg`,
      contentType: "image/jpeg",
    }
  } catch {
    throw new Error(
      "Unsupported image format. Please upload a JPG, PNG, or WebP photo (not HEIC/JXL).",
    )
  }
}
