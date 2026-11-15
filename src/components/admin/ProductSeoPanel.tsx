"use client"

type Props = {
  productName: string
  description: string
  publicOrigin: string
  seoTitle: string
  setSeoTitle: (value: string) => void
  metaDescription: string
  setMetaDescription: (value: string) => void
  urlSlug: string
  setUrlSlug: (value: string) => void
  keywords: string
  setKeywords: (value: string) => void
  focusKeyword: string
  setFocusKeyword: (value: string) => void
  ogTitle: string
  setOgTitle: (value: string) => void
  ogDescription: string
  setOgDescription: (value: string) => void
  imageAlt: string
  setImageAlt: (value: string) => void
  canonical: string
  setCanonical: (value: string) => void
  indexable: boolean
  setIndexable: (value: boolean) => void
  followable: boolean
  setFollowable: (value: boolean) => void
  brand: string
  setBrand: (value: string) => void
  gtin: string
  setGtin: (value: string) => void
  breadcrumb: string
  setBreadcrumb: (value: string) => void
  onTouchTitle: () => void
  onTouchDescription: () => void
  onTouchSlug: () => void
  onFill: () => void
  onSyncTitle: () => void
  onSyncSlug: () => void
}

function words(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function has(haystack: string, needle: string) {
  return needle.trim() !== "" && haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${ok ? "text-emerald-800" : "text-gray-600"}`}>
      <span className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
        {ok ? "✓" : ""}
      </span>
      {label}
    </li>
  )
}

export function ProductSeoPanel(props: Props) {
  const title = props.seoTitle.trim() || props.productName.trim() || "Product name"
  const summary = props.metaDescription.trim() || props.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Add a description so Google has something to show."
  const slug = props.urlSlug.trim() || "product-name"
  const keyword = props.focusKeyword.trim()
  const keywordList = words(props.keywords)
  const checks = [
    { ok: keyword.length > 0, label: "A focus keyword is set" },
    { ok: has(props.seoTitle, keyword), label: "Focus keyword is in the page title" },
    { ok: has(props.metaDescription, keyword), label: "Focus keyword is in the meta description" },
    { ok: has(slug, keyword.replace(/\s+/g, "-")), label: "Focus keyword is in the link" },
    { ok: props.seoTitle.length >= 30 && props.seoTitle.length <= 60, label: "Page title is 30–60 characters" },
    { ok: props.metaDescription.length >= 70 && props.metaDescription.length <= 160, label: "Meta description is 70–160 characters" },
    { ok: props.urlSlug.trim().length > 0, label: "The public link is set" },
    { ok: props.imageAlt.trim().length > 0, label: "The main image has alt text" },
    { ok: keywordList.length >= 3, label: "At least 3 search words" },
    { ok: props.indexable, label: "Google is allowed to index this page" },
  ]
  const score = checks.filter((item) => item.ok).length

  function addKeyword(raw: string) {
    const next = raw.trim().replace(/,/g, "")
    if (!next) return
    if (keywordList.some((item) => item.toLowerCase() === next.toLowerCase())) return
    props.setKeywords([...keywordList, next].join(", "))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Search, social, and schema</h3>
            <p className="text-gray-600">What Google, WhatsApp, and Facebook show, plus the product data behind the page.</p>
          </div>
          <button type="button" onClick={props.onFill} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
            Fill from this product
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Google</p>
          <p className="truncate text-sm text-emerald-800">{props.publicOrigin.replace(/^https?:\/\//, "")}/products/{slug}</p>
          <p className="mt-1 truncate text-xl text-[#1a0dab]">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">{summary}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-[#f0f2f5] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">WhatsApp / Facebook</p>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="h-24 bg-rose-100" />
              <div className="p-3">
                <p className="text-xs uppercase text-gray-400">ronnyandme.com</p>
                <p className="font-semibold text-gray-900">{props.ogTitle.trim() || title}</p>
                <p className="line-clamp-2 text-sm text-gray-600">{props.ogDescription.trim() || summary}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">X / Twitter</p>
            <p className="font-semibold text-gray-900">{props.ogTitle.trim() || title}</p>
            <p className="mt-1 line-clamp-3 text-sm text-gray-600">{props.ogDescription.trim() || summary}</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-900">Focus keyword</span>
          <input value={props.focusKeyword} onChange={(e) => props.setFocusKeyword(e.target.value)} placeholder="The one phrase this page should rank for" className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-rose-400 focus:ring-2 focus:ring-rose-400" />
          <p className="mt-2 text-sm text-gray-500">Put this exact phrase in the title, the description, and the link.</p>
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">Page title</label>
            <button type="button" onClick={props.onSyncTitle} className="text-sm font-medium text-rose-600 hover:underline">Sync with product name</button>
          </div>
          <input value={props.seoTitle} maxLength={70} onChange={(e) => { props.onTouchTitle(); props.setSeoTitle(e.target.value) }} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-rose-400 focus:ring-2 focus:ring-rose-400" />
          <p className={`mt-2 text-sm ${props.seoTitle.length > 60 ? "text-amber-700" : "text-gray-500"}`}>{props.seoTitle.length}/60 — Google cuts titles after about 60 characters.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">Meta description</label>
          <textarea rows={4} maxLength={320} value={props.metaDescription} onChange={(e) => { props.onTouchDescription(); props.setMetaDescription(e.target.value) }} className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-rose-400 focus:ring-2 focus:ring-rose-400" placeholder="What it is, who it is for, and why someone in Ghana would buy it." />
          <p className={`mt-2 text-sm ${props.metaDescription.length > 160 ? "text-amber-700" : "text-gray-500"}`}>{props.metaDescription.length}/160 — this is the grey text under the blue title.</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">Public link</label>
            <button type="button" onClick={props.onSyncSlug} className="text-sm font-medium text-rose-600 hover:underline">Sync with product name</button>
          </div>
          <div className="flex min-w-0">
            <span className="shrink-0 rounded-l-lg border-2 border-r-0 border-gray-300 bg-gray-100 px-3 py-3 text-sm text-gray-600">{props.publicOrigin}/products/</span>
            <input value={props.urlSlug} onChange={(e) => { props.onTouchSlug(); props.setUrlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-")) }} className="min-w-0 flex-1 rounded-r-lg border-2 border-gray-300 px-4 py-3 focus:border-rose-400 focus:ring-2 focus:ring-rose-400" spellCheck={false} />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">Search words</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {keywordList.map((word) => (
              <button key={word} type="button" onClick={() => props.setKeywords(keywordList.filter((item) => item !== word).join(", "))} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm">
                {word} ×
              </button>
            ))}
          </div>
          <input
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== ",") return
              e.preventDefault()
              addKeyword((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).value = ""
            }}
            placeholder="Type a word and press Enter"
            className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-rose-400 focus:ring-2 focus:ring-rose-400"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Social title</span>
            <input value={props.ogTitle} onChange={(e) => props.setOgTitle(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Leave blank to use the page title" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Image alt text</span>
            <input value={props.imageAlt} onChange={(e) => props.setImageAlt(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Lattafa Yara Candy perfume box" />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Social description</span>
          <textarea rows={3} value={props.ogDescription} onChange={(e) => props.setOgDescription(e.target.value)} className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Leave blank to use the meta description" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Breadcrumb name</span>
            <input value={props.breadcrumb} onChange={(e) => props.setBreadcrumb(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Short name in the trail" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Brand for search results</span>
            <input value={props.brand} onChange={(e) => props.setBrand(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Lattafa" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Barcode / GTIN</span>
            <input value={props.gtin} onChange={(e) => props.setGtin(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Optional" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Canonical link</span>
            <input value={props.canonical} onChange={(e) => props.setCanonical(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" placeholder="Only if this page should point at another URL" />
          </label>
        </div>

        <div className="flex flex-wrap gap-6 rounded-xl border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={props.indexable} onChange={(e) => props.setIndexable(e.target.checked)} />
            Let Google index this product
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={props.followable} onChange={(e) => props.setFollowable(e.target.checked)} />
            Let Google follow links on this page
          </label>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-rose-100 bg-rose-50 p-4 xl:sticky xl:top-24">
        <p className="text-sm text-gray-600">Search readiness</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{score}/{checks.length}</p>
        <ul className="mt-4 space-y-2">
          {checks.map((item) => <Check key={item.label} ok={item.ok} label={item.label} />)}
        </ul>
      </aside>
    </div>
  )
}
