/**
 * Single source of truth for reading/writing `variants.option_values`.
 *
 * Stored shape (what the admin form writes and every live row uses):
 *   [{ name: "Size", value: "M" }, { name: "Color", value: "Red", hex: "#EF4444" }]
 * Older imports used `attribute_name` instead of `name`; readers accept both.
 */

export type VariantOptionValue = {
  name: string
  value: string
  hex?: string
}

export type OptionKind = "color" | "size"

const HEX_RE = /^#[0-9a-f]{6}$/i

export const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL"]

export function optionFieldName(option: unknown): string {
  if (!option || typeof option !== "object") return ""
  const o = option as Record<string, unknown>
  const raw = o.name ?? o.attribute_name
  return typeof raw === "string" ? raw.trim() : ""
}

export function optionKind(fieldName: string): OptionKind {
  const lower = fieldName.toLowerCase()
  return lower.includes("color") || lower.includes("colour") ? "color" : "size"
}

function asOptionArray(optionValues: unknown): unknown[] {
  return Array.isArray(optionValues) ? optionValues : []
}

/** Returns the first option of the given kind (case-insensitive, name/attribute_name tolerant). */
export function findOption(optionValues: unknown, kind: OptionKind): VariantOptionValue | null {
  for (const option of asOptionArray(optionValues)) {
    const name = optionFieldName(option)
    if (!name || optionKind(name) !== kind) continue
    const o = option as Record<string, unknown>
    const value = o.value == null ? "" : String(o.value).trim()
    if (!value) continue
    const hex = typeof o.hex === "string" && HEX_RE.test(o.hex) ? o.hex : undefined
    return { name, value, ...(hex ? { hex } : {}) }
  }
  return null
}

export function normalizeHex(hex: string | null | undefined): string | undefined {
  return hex && HEX_RE.test(hex) ? hex.toUpperCase() : undefined
}

export function buildOptionValues(input: {
  size?: string | null
  color?: string | null
  colorHex?: string | null
}): VariantOptionValue[] {
  const out: VariantOptionValue[] = []
  const size = input.size?.trim()
  const color = input.color?.trim()
  if (size) out.push({ name: "Size", value: size })
  if (color) {
    const hex = normalizeHex(input.colorHex)
    out.push({ name: "Color", value: color, ...(hex ? { hex } : {}) })
  }
  return out
}

/** Clothing sizes in natural order, then numeric sizes ascending, then everything else alphabetically. */
export function sortSizeOptions(values: string[]): string[] {
  const rank = (v: string) => {
    const i = SIZE_ORDER.indexOf(v.trim().toUpperCase())
    return i === -1 ? Number.POSITIVE_INFINITY : i
  }
  return [...values].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  })
}

/** Case-insensitive comparison for option values ("nude" and "Nude" are the same color). */
export function sameOptionValue(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()
}
