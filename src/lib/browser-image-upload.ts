/** Formats we accept for product/category uploads in the admin UI. */
export const ACCEPT_PRODUCT_IMAGES =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,image/*"

const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i

/**
 * Convert any browser-decodable image to JPEG before upload so HEIC/JXL
 * (and oversized phone photos) never hit storage as unsupported formats.
 */
export async function prepareImageForUpload(
  file: File,
): Promise<{ file: File; path: string }> {
  const originalExt = (file.name.split(".").pop() || "jpg").toLowerCase()
  const safeExt =
    originalExt === "jpg"
      ? "jpeg"
      : ["jpeg", "png", "webp", "gif"].includes(originalExt)
        ? originalExt
        : "jpeg"

  // Always normalize phone/camera uploads client-side when possible.
  if (ALLOWED_EXT.test(file.name) && file.size <= 3_500_000) {
    const path = `${Math.random()}.${safeExt}`
    return { file, path }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      "This image format cannot be read. Please export or re-save it as JPG or PNG and try again.",
    )
  }

  try {
    const maxEdge = 2000
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG"))),
        "image/jpeg",
        0.85,
      )
    })

    const path = `${Math.random()}.jpeg`
    const next = new File([blob], path, { type: "image/jpeg" })
    return { file: next, path }
  } finally {
    bitmap.close()
  }
}
