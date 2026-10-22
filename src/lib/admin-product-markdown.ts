export type MarkdownType = "percent" | "fixed"

export type ProductMarkdown = {
  original_price: number
  original_compare_at: number | null
  original_sale_price: number | null
  variants?: Record<
    string,
    {
      original_price: number
      original_compare_at: number | null
      original_sale_price: number | null
    }
  >
  type: MarkdownType
  value: number
  applied_at: string
}

export function markdownPrice(base: number, type: MarkdownType, value: number): number {
  const next = type === "percent" ? base * (1 - value / 100) : base - value
  return Math.round(next * 100) / 100
}

export function readMarkdown(metadata: unknown): ProductMarkdown | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = (metadata as { discount?: unknown }).discount
  if (!raw || typeof raw !== "object") return null
  const d = raw as Partial<ProductMarkdown>
  if (typeof d.original_price !== "number" || !(d.original_price > 0)) return null
  if (d.type !== "percent" && d.type !== "fixed") return null
  if (typeof d.value !== "number") return null
  return d as ProductMarkdown
}
