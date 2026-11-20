"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { cn, formatPrice } from "@/lib/utils"
import { optimizedImageUrl } from "@/lib/product-image"
import type { ProductSearchResult } from "@/types/product-search"

/**
 * The header's search box. Typing shows up to a handful of matching products
 * underneath; Enter (or the Search button) opens the full results on /shop.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listId = useId()
  const inputId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const debounced = useDebouncedValue(query, 250)
  const term = debounced.trim()

  // Start loading as soon as the settled term changes (during render, not in an effect).
  const [prevTerm, setPrevTerm] = useState(term)
  if (prevTerm !== term) {
    setPrevTerm(term)
    setActive(-1)
    setFailed(false)
    if (term) setLoading(true)
    else {
      setResults([])
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!term) return
    const ac = new AbortController()
    fetch(`/api/products/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Search failed")
        return res.json() as Promise<{ results: ProductSearchResult[] }>
      })
      .then((data) => setResults((data.results ?? []).slice(0, 6)))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setFailed(true)
        setResults([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [term])

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    return () => document.removeEventListener("pointerdown", onPointer)
  }, [open])

  function goToShop() {
    const q = query.trim()
    setOpen(false)
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop")
  }

  function goToProduct(slug: string) {
    setOpen(false)
    router.push(`/products/${slug}`)
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && results[active]) goToProduct(results[active].slug)
          else goToShop()
        }}
        className="flex h-12 items-center overflow-hidden rounded-xl border-2 border-brand bg-white"
      >
        <label htmlFor={inputId} className="sr-only">
          Search products
        </label>
        <Search className="ml-3.5 size-5 shrink-0 text-ink" aria-hidden />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false)
            if (!showPanel || results.length === 0) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => (i + 1) % results.length)
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
            }
          }}
          placeholder="Search soap, lip liner, serum…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink placeholder:text-mute focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="h-full shrink-0 bg-brand px-5 text-[15px] font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Search
        </button>
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[70] overflow-hidden rounded-xl border border-line bg-white shadow-[0_16px_40px_-12px_rgba(22,24,29,0.25)]">
          {loading ? (
            <p className="flex items-center gap-2 px-4 py-5 text-[15px] text-mute">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </p>
          ) : failed ? (
            <p className="px-4 py-5 text-[15px] text-mute">
              Search isn&apos;t working right now. Press Search to see results on the shop page.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-5 text-[15px] text-mute">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Try another spelling.
            </p>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label="Matching products" className="py-1">
                {results.map((p, i) => (
                  <li
                    key={p.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => goToProduct(p.slug)}
                    onPointerEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2",
                      i === active && "bg-counter",
                    )}
                  >
                    <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-counter">
                      {p.imageUrl ? (
                        <img
                          src={optimizedImageUrl(p.imageUrl, 96)}
                          alt=""
                          className="size-full object-cover"
                          decoding="async"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                      {p.minPrice != null && (
                        <span className="block text-sm tabular-nums text-mute">{formatPrice(p.minPrice)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goToShop}
                className="w-full border-t border-line px-4 py-3 text-left text-[15px] font-bold text-raspberry hover:bg-counter"
              >
                See all results for &ldquo;{query.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
