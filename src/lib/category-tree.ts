/**
 * Order categories for admin/shop UI: parents first (by sort_order, name), then each
 * subtree depth-first so Skin care → Skin care set / Body lotion / … reads as a tree.
 */
export type CategoryLike = {
  id: string
  name?: string | null
  parent_id?: string | null
  sort_order?: number | string | null
}

export function sortCategoriesForDisplay<T extends CategoryLike>(categories: T[]): T[] {
  const sortKey = (a: T, b: T) => {
    const so = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    if (so !== 0) return so
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  }

  const out: T[] = []

  const walk = (parentId: string | null) => {
    const children = categories
      .filter((c) => (c.parent_id ?? null) === parentId)
      .sort(sortKey)
    for (const ch of children) {
      out.push(ch)
      walk(ch.id)
    }
  }

  walk(null)

  const seen = new Set(out.map((c) => c.id))
  const orphans = categories.filter((c) => !seen.has(c.id)).sort(sortKey)
  out.push(...orphans)
  return out
}

export function categoryDepth<T extends CategoryLike>(
  cat: T,
  byId: Map<string, T>,
): number {
  let d = 0
  let pid: string | null | undefined = cat.parent_id
  while (pid) {
    d += 1
    const p = byId.get(pid)
    if (!p) break
    pid = p.parent_id
  }
  return d
}

/** Label for selects: indented tree (no HTML in <option>, use plain text). */
export function categoryOptionLabel<T extends CategoryLike>(
  cat: T,
  byId: Map<string, T>,
): string {
  const depth = categoryDepth(cat, byId)
  const pad = depth > 0 ? `${'  '.repeat(depth)}↳ ` : ''
  return `${pad}${cat.name ?? ''}`.trim()
}

/** IDs of this category and every row that lists it as an ancestor (prevent parent cycles). */
export function getSelfAndDescendantIds(
  rootId: string,
  categories: { id: string; parent_id?: string | null }[],
): Set<string> {
  const byParent = new Map<string | null, string[]>()
  for (const c of categories) {
    const p = c.parent_id ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(c.id)
  }
  const out = new Set<string>()
  const walk = (id: string) => {
    out.add(id)
    const kids = byParent.get(id)
    if (!kids) return
    for (const k of kids) walk(k)
  }
  walk(rootId)
  return out
}
