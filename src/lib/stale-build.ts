/**
 * After a deploy, a tab that was already open still runs the old build. When
 * it navigates, it asks for script files the new build no longer has, and the
 * page fails to load. One fresh reload fixes it, so do that automatically —
 * at most once per page every 30 seconds, so a real bug can't loop.
 */
const STALE_BUILD = /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|Importing a module script failed|Failed to fetch RSC payload|error loading dynamically imported/i

export function reloadIfStaleBuild(error: unknown): boolean {
  if (typeof window === "undefined") return false
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "")
  if (!STALE_BUILD.test(text)) return false

  const key = `rme:stale-reload:${window.location.pathname}`
  try {
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // Storage blocked: still reload once; the browser won't loop on a fresh load.
  }
  window.location.reload()
  return true
}
