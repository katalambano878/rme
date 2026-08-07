import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { readObject } from "@/lib/db/storage"

const STORAGE_ROOT =
  process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage")
const FETCH_TIMEOUT_MS = 10_000

const PUBLIC_PATH_PREFIXES = [
  "/brand",
  "/categories",
  "/images",
  "/mock-product.png",
]

const STORAGE_PUBLIC_RE =
  /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

function parseWidth(value: string | null): number {
  const n = value ? Number.parseInt(value, 10) : 800
  if (!Number.isFinite(n) || n < 1) return 800
  return Math.min(n, 1600)
}

function parseQuality(value: string | null): number {
  const n = value ? Number.parseInt(value, 10) : 70
  if (!Number.isFinite(n)) return 70
  return Math.min(90, Math.max(40, n))
}

function hostOnly(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? ""
}

function isAllowedHost(host: string, requestHost: string): boolean {
  const h = hostOnly(host)
  const req = hostOnly(requestHost)
  if (h === req) return true
  if (h === "localhost" || h === "127.0.0.1") return true
  if (h.endsWith(".supabase.co")) return true
  if (h === "ronnyandme.com" || h === "www.ronnyandme.com") return true
  if (h.endsWith(".sslip.io")) return true
  return false
}

function isPublicRelativePath(src: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => src === prefix || src.startsWith(`${prefix}/`),
  )
}

function isAllowedSrc(src: string, requestHost: string): boolean {
  if (src.startsWith("/")) {
    if (src.startsWith("/storage/")) return true
    return isPublicRelativePath(src)
  }

  try {
    const url = new URL(src)
    return isAllowedHost(url.host, requestHost)
  } catch {
    return false
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function readPublicFile(relativePath: string): Promise<Buffer | null> {
  const clean = relativePath.replace(/^\/+/, "")
  const full = path.normalize(path.join(process.cwd(), "public", clean))
  const base = path.normalize(path.join(process.cwd(), "public"))
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
    if (!m) return null
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

async function loadSourceBytes(
  src: string,
  request: NextRequest,
): Promise<LoadResult> {
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
          try {
            const full = path.join(STORAGE_ROOT, bucket, objectPath)
            await fs.mkdir(path.dirname(full), { recursive: true })
            await fs.writeFile(full, bytes)
            const ct = res.headers.get("content-type")
            if (ct) {
              await fs.writeFile(
                `${full}.meta.json`,
                JSON.stringify({ contentType: ct }),
              )
            }
          } catch {
            /* ignore cache write failures */
          }
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

  if (src.startsWith("/")) {
    if (isPublicRelativePath(src)) {
      const bytes = await readPublicFile(src)
      if (!bytes) return { ok: false, reason: "not_found" }
      return { ok: true, bytes }
    }

    if (src.startsWith("/storage/")) {
      const origin = request.nextUrl.origin
      try {
        const res = await fetchWithTimeout(`${origin}${src}`)
        if (!res.ok) return { ok: false, reason: "not_found" }
        return { ok: true, bytes: Buffer.from(await res.arrayBuffer()) }
      } catch {
        return { ok: false, reason: "fetch_failed" }
      }
    }
  }

  if (src.startsWith("http://") || src.startsWith("https://")) {
    try {
      const res = await fetchWithTimeout(src)
      if (!res.ok) return { ok: false, reason: "not_found" }
      return { ok: true, bytes: Buffer.from(await res.arrayBuffer()) }
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
  const src = request.nextUrl.searchParams.get("src")?.trim()
  if (!src) {
    return NextResponse.json({ error: "Missing src parameter" }, { status: 400 })
  }

  const requestHost = request.headers.get("host") ?? "localhost"
  if (!isAllowedSrc(src, requestHost)) {
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

  const loaded = await loadSourceBytes(src, request)
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
    return NextResponse.json({ error: "Image processing failed" }, { status: 502 })
  }
}
