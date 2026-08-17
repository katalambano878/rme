/**
 * Supabase browser uploads arrive as multipart/form-data (WebKit boundaries).
 * Our storage shim must extract the actual file bytes before saving.
 */
export function extractUploadBody(
  raw: Buffer,
  contentType?: string | null,
): Buffer {
  const ct = (contentType || "").toLowerCase()
  const looksMultipart =
    ct.includes("multipart/form-data") ||
    (raw.length > 2 && raw[0] === 0x2d && raw[1] === 0x2d)

  if (!looksMultipart) return raw

  let boundary: string | null = null
  const headerMatch = ct.match(/boundary=([^;]+)/i)
  if (headerMatch) {
    boundary = headerMatch[1].trim().replace(/^"|"$/g, "")
  }
  if (!boundary) {
    const firstLine = raw.subarray(0, Math.min(raw.length, 200)).toString("utf8")
    const lineEnd = firstLine.indexOf("\r\n")
    if (lineEnd > 2 && firstLine.startsWith("--")) {
      boundary = firstLine.slice(2, lineEnd)
    }
  }
  if (!boundary) return raw

  const delimiter = Buffer.from(`--${boundary}`)
  const parts = splitBuffer(raw, delimiter)
  let best: Buffer | null = null

  for (const part of parts) {
    const trimmed = stripLeadingCrLf(part)
    if (!trimmed.length) continue

    const headerEnd = indexOfBuffer(trimmed, Buffer.from("\r\n\r\n"))
    if (headerEnd === -1) continue

    const headers = trimmed.subarray(0, headerEnd).toString("utf8").toLowerCase()
    let body = trimmed.subarray(headerEnd + 4)
    body = stripTrailingCrLf(body)

    const hasFilename = headers.includes("filename=")
    const isImage =
      headers.includes("content-type: image/") ||
      body[0] === 0x89 ||
      body[0] === 0xff ||
      body.subarray(0, 4).toString("ascii") === "RIFF" ||
      body.subarray(0, 3).toString("ascii") === "GIF"

    if (hasFilename || isImage) {
      if (!best || body.length > best.length) {
        best = body
      }
    }
  }

  return best && best.length > 0 ? best : raw
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

function indexOfBuffer(buf: Buffer, needle: Buffer): number {
  return buf.indexOf(needle)
}

function stripLeadingCrLf(buf: Buffer): Buffer {
  let i = 0
  while (i < buf.length && (buf[i] === 0x0d || buf[i] === 0x0a)) i++
  return buf.subarray(i)
}

function stripTrailingCrLf(buf: Buffer): Buffer {
  let end = buf.length
  while (end > 0 && (buf[end - 1] === 0x0d || buf[end - 1] === 0x0a)) end--
  if (end >= 2 && buf[end - 2] === 0x2d && buf[end - 1] === 0x2d) end -= 2
  while (end > 0 && (buf[end - 1] === 0x0d || buf[end - 1] === 0x0a)) end--
  return buf.subarray(0, end)
}

/** True when bytes look like a saved multipart wrapper, not a real image file. */
export function isMultipartWrapper(bytes: Buffer): boolean {
  return bytes.length > 4 && bytes[0] === 0x2d && bytes[1] === 0x2d
}
