"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Search, X, Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { formatPrice } from "@/lib/utils"
import type { ProductSearchResult } from "@/types/product-search"

const popularSearches = [
  "Rosé Quilted Tote",
  "Silk Wrap Dress",
  "Velvet Rose Perfume",
  "Kitten Heels",
  "Pearl Earrings",
  "Gift Sets",
]

type SearchOverlayProps = {
  open: boolean
  onClose: () => void
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 280)
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery("")
      setResults([])
      setError(null)
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (q.length < 1) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/products/search?q=${encodeURIComponent(q)}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Search failed")
        }
        return res.json() as Promise<{ results: ProductSearchResult[] }>
      })
      .then((data) => {
        setResults(data.results ?? [])
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Search failed")
        setResults([])
      })
      .finally(() => {
        setLoading(false)
      })

    return () => ac.abort()
  }, [debouncedQuery, open])

  const showResultsPanel = query.trim().length > 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden border-t border-rose-border/30 bg-white"
        >
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-navy/30" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full rounded-2xl border border-rose-border bg-rose-light/30 pl-12 pr-12 font-sans text-base text-navy placeholder:text-navy/30 transition-all focus:border-rose-primary focus:outline-none focus:ring-2 focus:ring-rose-primary/20"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="search-results"
              />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-navy/40 transition-colors hover:bg-rose-light hover:text-navy"
                aria-label="Close search"
              >
                <X className="size-4" />
              </button>
            </div>

            {showResultsPanel && (
              <div
                id="search-results"
                className="mt-4 max-h-[min(60vh,420px)] overflow-y-auto rounded-2xl border border-rose-border/60 bg-white shadow-sm"
                role="listbox"
              >
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin text-rose-primary" />
                    Searching…
                  </div>
                )}
                {!loading && error && (
                  <p className="px-4 py-6 text-center text-sm text-red-600">
                    {error}
                  </p>
                )}
                {!loading && !error && results.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No products match &ldquo;{query.trim()}&rdquo;. Try another
                    spelling or browse the shop.
                  </p>
                )}
                {!loading && !error && results.length > 0 && (
                  <ul className="divide-y divide-rose-border/40 py-1">
                    {results.map((p) => (
                      <li key={p.id} role="option">
                        <Link
                          href={`/products/${p.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-rose-light/40"
                        >
                          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-rose-light">
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-navy">
                              {p.name}
                            </p>
                            {p.minPrice != null && (
                              <p className="text-sm text-muted-foreground">
                                {formatPrice(p.minPrice)}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!showResultsPanel && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="mr-1 self-center text-xs text-navy/40">
                  Popular:
                </span>
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="rounded-full bg-rose-light/50 px-3 py-1.5 text-xs font-medium text-navy/60 transition-colors hover:bg-rose-light"
                    onClick={() => {
                      setQuery(term)
                      inputRef.current?.focus()
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
