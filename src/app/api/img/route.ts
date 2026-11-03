import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { PUBLIC_BUCKETS, cacheObject, readObject } from "@/lib/db/storage"

const STORAGE_ROOT =
  process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage")
const FETCH_TIMEOUT_MS = 10_000
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

const PUBLIC_PATH_PREFIXES = [
  "/brand",
  "/categories",
  "/images",
  "/mock-product.png",
]

const STORAGE_PUBLIC_RE =
  /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

// Fixed steps so a loop over w/q can't fill the disk cache with variants.
const WIDTHS = [64, 128, 200, 256, 320, 384, 480, 640, 750, 828, 960, 1080, 1200, 1600]

function parseWidth(value: string | null): number {
  const n = value ? Number.parseInt(value, 10) : 800
  if (!Number.isFinite(n) || n < 1) return 828
  return WIDTHS.find((w) => w >= n) ?? 1600
}

function parseQuality(value: string | null): number {
  const n = value ? Number.parseInt(value, 10) : 70
  if (!Number.isFinite(n)) return 70
  return Math.round(Math.min(90, Math.max(40, n)) / 10) * 10
}

function hostOnly(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? ""
}

/**
 * Remote images may only come from the store's own domain or Supabase public
 * storage. No localhost, wildcard DNS (sslip.io) or Host-header matching: those
 * let anyone make the server fetch internal addresses.
 */
function isAllowedRemote(url: URL): boolean {
  if (url.protocol !== "https:") return false
  if (url.username || url.password || (url.port && url.port !== "443")) return false
  const h = hostOnly(url.host)
  if (h === "ronnyandme.com" || h === "www.ronnyandme.com") return true
  return (
    h.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/v1/object/public/")
  )
}

function isPublicRelativePath(src: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => src === prefix || src.startsWith(`${prefix}/`),
  )
}

function isAllowedSrc(src: string): boolean {
  if (src.startsWith("//")) return false
  if (src.startsWith("/")) {
    const storage = src.match(STORAGE_PUBLIC_RE)
    if (storage) return PUBLIC_BUCKETS.has(storage[1])
    return isPublicRelativePath(src)
  }

  try {
    return isAllowedRemote(new URL(src))
  } catch {
    return false
  }
}

/** Drop query/hash so `?n=1`, `?n=2`, ... map to one cache entry. */
function canonicalSrc(src: string): string {
  if (src.startsWith("/")) return src.split(/[?#]/)[0]
  try {
    const u = new URL(src)
    return `${u.origin}${u.pathname}`
  } catch {
    return src
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // redirect: "error" — an allowed host must not bounce us somewhere internal.
    return await fetch(url, { signal: controller.signal, redirect: "error" })
  } finally {
    clearTimeout(timeout)
  }
}

async function readPublicFile(relativePath: string): Promise<Buffer | null> {
  const clean = relativePath.replace(/^\/+/, "")
  const full = path.normalize(path.join(process.cwd(), "public", clean))
  const base = path.normalize(path.join(process.cwd(), "public")) + path.sep
  if (!full.startsWith(base)) return null
  try {
    return await fs.readFile(full)
  } catch {
    return null
  }
}

type LoadResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: "not_found" | "fetch_failed" }

/** Prefer local disk when a Supabase public storage URL was never migrated. */
function supabasePublicToLocal(src: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(src)
    if (!u.hostname.endsWith(".supabase.co")) return null
    const m = u.pathname.match(
      /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
    )
    if (!m || !PUBLIC_BUCKETS.has(m[1])) return null
    return { bucket: m[1], objectPath: decodeURIComponent(m[2]) }
  } catch {
    return null
  }
}

/** Optional origin for files never copied to local STORAGE_ROOT (legacy Supabase). */
function legacyStorageOrigin(): string | null {
  const raw =
    process.env.LEGACY_SUPABASE_URL ||
    process.env.LEGACY_STORAGE_ORIGIN ||
    ""
  const trimmed = raw.trim().replace(/\/+$/, "")
  return trimmed || null
}

async function loadSourceBytes(src: string): Promise<LoadResult> {
  const storageMatch = src.match(STORAGE_PUBLIC_RE)
  if (storageMatch) {
    const bucket = storageMatch[1]
    const objectPath = decodeURIComponent(storageMatch[2])
    const result = await readObject(bucket, objectPath)
    if (result?.bytes) return { ok: true, bytes: result.bytes }

    // Self-heal: pull from legacy Supabase public storage when local disk misses.
    const legacy = legacyStorageOrigin()
    if (legacy) {
      try {
        const remote = `${legacy}/storage/v1/object/public/${bucket}/${objectPath
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
        const res = await fetchWithTimeout(remote)
        if (res.ok) {
          const bytes = Buffer.from(await res.arrayBuffer())
          // Best-effort local cache so subsequent hits stay on disk.
          await cacheObject(
            bucket,
            objectPath,
            bytes,
            res.headers.get("content-type"),
          )
          return { ok: true, bytes }
        }
      } catch {
        /* fall through */
      }
    }

    return { ok: false, reason: "not_found" }
  }

  const fromSupabase = supabasePublicToLocal(src)
  if (fromSupabase) {
    const local = await readObject(fromSupabase.bucket, fromSupabase.objectPath)
    if (local?.bytes) return { ok: true, bytes: local.bytes }
    // fall through to remote fetch + cache
  }

  if (src.startsWith("/") && isPublicRelativePath(src)) {
    const bytes = await readPublicFile(src)
    if (!bytes) return { ok: false, reason: "not_found" }
    return { ok: true, bytes }
  }

  if (src.startsWith("https://")) {
    try {
      const res = await fetchWithTimeout(src)
      if (!res.ok) return { ok: false, reason: "not_found" }
      const type = res.headers.get("content-type") || ""
      if (!type.startsWith("image/")) return { ok: false, reason: "not_found" }
      const declared = Number(res.headers.get("content-length") || 0)
      if (declared > MAX_SOURCE_BYTES) return { ok: false, reason: "fetch_failed" }
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length > MAX_SOURCE_BYTES) return { ok: false, reason: "fetch_failed" }
      return { ok: true, bytes }
    } catch {
      return { ok: false, reason: "fetch_failed" }
    }
  }

  return { ok: false, reason: "not_found" }
}

function cacheHash(src: string, width: number, quality: number): string {
  return createHash("sha256")
    .update(`${src}|w=${width}|q=${quality}`)
    .digest("hex")
}

async function readCachedWebp(hash: string): Promise<Buffer | null> {
  const cachePath = path.join(STORAGE_ROOT, "img-cache", `${hash}.webp`)
  try {
    return await fs.readFile(cachePath)
  } catch {
    return null
  }
}

async function writeCachedWebp(hash: string, bytes: Buffer): Promise<void> {
  const cacheDir = path.join(STORAGE_ROOT, "img-cache")
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(path.join(cacheDir, `${hash}.webp`), bytes)
}

async function optimizeImage(
  sourceBytes: Buffer,
  width: number,
  quality: number,
): Promise<Buffer> {
  return sharp(sourceBytes)
    .resize(width, undefined, { withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
}

export async function GET(request: NextRequest) {
  const rawSrc = request.nextUrl.searchParams.get("src")?.trim()
  if (!rawSrc) {
    return NextResponse.json({ error: "Missing src parameter" }, { status: 400 })
  }

  const src = canonicalSrc(rawSrc)
  if (!isAllowedSrc(src)) {
    return NextResponse.json({ error: "Invalid src" }, { status: 400 })
  }

  const width = parseWidth(request.nextUrl.searchParams.get("w"))
  const quality = parseQuality(request.nextUrl.searchParams.get("q"))
  const hash = cacheHash(src, width, quality)

  const cached = await readCachedWebp(hash)
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  }

  const loaded = await loadSourceBytes(src)
  if (!loaded.ok) {
    const headers = { "Cache-Control": "no-store" }
    if (loaded.reason === "fetch_failed") {
      return NextResponse.json(
        { error: "Failed to fetch source" },
        { status: 502, headers },
      )
    }
    return NextResponse.json(
      { error: "Source not found" },
      { status: 404, headers },
    )
  }

  try {
    const optimized = await optimizeImage(loaded.bytes, width, quality)
    await writeCachedWebp(hash, optimized)
    return new NextResponse(new Uint8Array(optimized), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    // Never echo unprocessed bytes back: that turned the proxy into a file reader.
    return NextResponse.json(
      { error: "Image processing failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }
}
