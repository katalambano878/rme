"use client"

import { useEffect, useRef } from "react"

/**
 * Remembers list state (e.g. how many products were loaded, sort, filters) and the
 * scroll position for the current tab, and restores both when the shopper comes back
 * from a product page — so they continue where they stopped instead of at the top.
 *
 * `restore` is called once after mount with the saved state; scroll is restored on
 * the following frames so the restored items are on screen first.
 */
export function useListPositionMemory<T extends object>(
  storageKey: string,
  state: T,
  restore: (saved: T) => void,
) {
  const ready = useRef(false)
  const restoreRef = useRef(restore)
  useEffect(() => {
    restoreRef.current = restore
  })

  useEffect(() => {
    ready.current = false
    let savedScroll = 0
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: T; scrollY?: number }
        if (parsed.state) restoreRef.current(parsed.state)
        savedScroll = typeof parsed.scrollY === "number" ? parsed.scrollY : 0
      }
    } catch {
      // Best-effort: corrupted or unavailable storage just means starting at the top.
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (savedScroll > 0) window.scrollTo(0, savedScroll)
        ready.current = true
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [storageKey])

  const stateJson = JSON.stringify(state)
  useEffect(() => {
    if (!ready.current) return
    save(storageKey, { state: JSON.parse(stateJson) as T })
  }, [storageKey, stateJson])

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (ready.current) save(storageKey, { scrollY: window.scrollY })
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [storageKey])
}

function save(storageKey: string, patch: Record<string, unknown>) {
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }))
  } catch {
    // Storage full/blocked: position memory is a convenience, never block shopping.
  }
}
