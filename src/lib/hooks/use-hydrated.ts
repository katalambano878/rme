"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False during SSR and the hydration pass, true afterwards. Use it to hold back
 * values that only exist in the browser (the saved bag / wishlist in localStorage),
 * so the first client render matches the server HTML and React doesn't rebuild the page.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
