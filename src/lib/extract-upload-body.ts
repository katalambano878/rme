/**
 * Supabase browser uploads arrive as multipart/form-data (WebKit boundaries).
 * Our storage shim must extract the actual file bytes before saving.
 *
 * Boundaries are case-sensitive, so the raw header value is used for parsing
 * while only the media type is compared case-insensitively.
 */
export function extractUploadBody(
  raw: Buffer,
  contentType?: string | null,
): Buffer {
  const header = contentType || ""
  const looksMultipart =
    header.toLowerCase().includes("multipart/form-data") ||
    isMultipartWrapper(raw)

  if (!looksMultipart) return raw

  const boundary = parseBoundary(header) ?? boundaryFromBody(raw)
  if (!boundary) return raw

  const delimiter = Buffer.from(`--${boundary}`, "latin1")
  let best: Buffer | null = null

  for (const part of splitBuffer(raw, delimiter)) {
    const trimmed = stripLeadingCrLf(part)
    if (!trimmed.length) continue

    const headerEnd = trimmed.indexOf(HEADER_SEPARATOR)
    if (headerEnd === -1) continue

    const headers = trimmed.subarray(0, headerEnd).toString("latin1").toLowerCase()
    const body = stripOneTrailingCrLf(trimmed.subarray(headerEnd + HEADER_SEPARATOR.length))
    if (!body.length) continue

    const isFilePart =
      headers.includes("filename=") ||
      headers.includes("content-type: image/") ||
      looksLikeImage(body)

    if (isFilePart && (!best || body.length > best.length)) {
      best = body
    }
  }

  return best && best.length > 0 ? best : raw
}

const HEADER_SEPARATOR = Buffer.from("\r\n\r\n", "latin1")

function parseBoundary(header: string): string | null {
  // Case-sensitive value, but the `boundary` attribute name is not.
  const match = header.match(/;\s*boundary=([^;]+)/i)
  if (!match) return null
  const value = match[1].trim().replace(/^"(.*)"$/, "$1")
  return value || null
}

function boundaryFromBody(raw: Buffer): string | null {
  const head = raw.subarray(0, Math.min(raw.length, 512)).toString("latin1")
  const lineEnd = head.indexOf("\r\n")
  if (lineEnd <= 2 || !head.startsWith("--")) return null
  return head.slice(2, lineEnd) || null
}

/** Detects the common web image magic numbers. */
function looksLikeImage(body: Buffer): boolean {
  if (body.length < 4) return false
  if (body[0] === 0x89 && body[1] === 0x50) return true // PNG
  if (body[0] === 0xff && body[1] === 0xd8) return true // JPEG
  if (body.subarray(0, 4).toString("latin1") === "RIFF") return true // WebP
  if (body.subarray(0, 3).toString("latin1") === "GIF") return true // GIF
  if (body.subarray(4, 8).toString("latin1") === "ftyp") return true // HEIC/AVIF
  return false
}

function splitBuffer(buf: Buffer, sep: Buffer): Buffer[] {
  const out: Buffer[] = []
  let start = 0
  while (start <= buf.length) {
    const idx = buf.indexOf(sep, start)
    if (idx === -1) {
      if (start < buf.length) out.push(buf.subarray(start))
      break
    }
    if (idx > start) out.push(buf.subarray(start, idx))
    start = idx + sep.length
  }
  return out
}

function stripLeadingCrLf(buf: Buffer): Buffer {
  let i = 0
  while (i < buf.length && (buf[i] === 0x0d || buf[i] === 0x0a)) i++
  return buf.subarray(i)
}

/**
 * Multipart part bodies are terminated by exactly one CRLF before the next
 * delimiter. Strip only that, never bytes that belong to the image itself.
 */
function stripOneTrailingCrLf(buf: Buffer): Buffer {
  const end = buf.length
  if (end >= 2 && buf[end - 2] === 0x0d && buf[end - 1] === 0x0a) {
    return buf.subarray(0, end - 2)
  }
  if (end >= 1 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) {
    return buf.subarray(0, end - 1)
  }
  return buf
}

/** True when bytes look like a saved multipart wrapper, not a real image file. */
export function isMultipartWrapper(bytes: Buffer): boolean {
  return bytes.length > 4 && bytes[0] === 0x2d && bytes[1] === 0x2d
}
