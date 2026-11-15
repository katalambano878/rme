'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-api';

type Row = {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  category: string | null;
  image: string | null;
  stock: number | null;
  regularPrice: number;
  sellingPrice: number;
  onPromotion: boolean;
  costPrice: number | null;
  supplierName: string | null;
  notes: string | null;
  costUpdatedAt: string | null;
  unitsSold30d: number;
};

type Draft = { cost: string; supplier: string; notes: string };
type Filter = 'all' | 'missing' | 'low';

const LOW_MARGIN = 25;
const field = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm';

function margin(price: number, cost: number | null) {
  if (cost == null || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

function marginTone(value: number | null) {
  if (value == null) return 'text-gray-400';
  if (value < 0) return 'text-red-600';
  if (value < LOW_MARGIN) return 'text-amber-600';
  return 'text-green-700';
}

export default function ProfitPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ cost: '', supplier: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ products: Row[] }>('/api/admin/profit');
      setRows(data.products);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const costed = rows.filter((row) => row.costPrice != null);
    const stockValueCost = costed.reduce((sum, row) => sum + (row.costPrice || 0) * Math.max(0, row.stock || 0), 0);
    const stockValueRetail = costed.reduce((sum, row) => sum + row.sellingPrice * Math.max(0, row.stock || 0), 0);
    const margins = costed.map((row) => margin(row.sellingPrice, row.costPrice)).filter((value): value is number => value != null);
    return {
      costed: costed.length,
      missing: rows.length - costed.length,
      average: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
      stockValueCost,
      stockProfit: stockValueRetail - stockValueCost,
    };
  }, [rows]);

  const visible = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q && !`${row.name} ${row.sku || ''} ${row.supplierName || ''} ${row.category || ''}`.toLowerCase().includes(q)) return false;
    if (filter === 'missing') return row.costPrice == null;
    if (filter === 'low') {
      const value = margin(row.sellingPrice, row.costPrice);
      return value != null && value < LOW_MARGIN;
    }
    return true;
  });

  function startEdit(row: Row) {
    setEditing(row.id);
    setFlash('');
    setDraft({ cost: row.costPrice != null ? String(row.costPrice) : '', supplier: row.supplierName || '', notes: row.notes || '' });
  }

  async function save(row: Row) {
    setSaving(true);
    try {
      const result = await adminFetch<{ message: string }>('/api/admin/profit', {
        method: 'PUT',
        body: JSON.stringify({
          productId: row.id,
          costPrice: draft.cost.trim() === '' ? null : draft.cost,
          supplierName: draft.supplier,
          notes: draft.notes,
        }),
      });
      setFlash(result.message);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const draftCost = draft.cost.trim() === '' ? null : Number(draft.cost);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profit margins</h1>
        <p className="mt-1 text-gray-600">Enter what each item cost from the supplier. Customers never see these costs.</p>
      </div>
      {error && <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {flash && <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-800">{flash}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-rose-700 p-5 text-white">
          <p className="text-sm text-rose-100">Average margin</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{totals.average == null ? '—' : `${totals.average.toFixed(1)}%`}</p>
          <p className="mt-1 text-xs text-rose-100">Across {totals.costed} costed product{totals.costed === 1 ? '' : 's'}</p>
        </div>
        <Stat label="Stock at cost" value={cedis(totals.stockValueCost)} hint="What the stock on hand cost you" />
        <Stat label="Profit in stock" value={cedis(totals.stockProfit)} hint="If everything on hand sells at today’s price" />
        <Stat label="Missing a cost" value={String(totals.missing)} hint="Products without a supplier price" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU or supplier" className={`${field} sm:w-80`} />
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {([['all', 'All'], ['missing', 'No cost yet'], ['low', `Under ${LOW_MARGIN}%`]] as [Filter, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === key ? 'bg-rose-700 text-white' : 'text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading ? <p className="p-12 text-center text-gray-500">Loading…</p> : visible.length === 0 ? <p className="p-12 text-center text-gray-500">No products match.</p> : (
          <ul className="divide-y divide-gray-100">
            {visible.map((row) => {
              const sellingMargin = margin(row.sellingPrice, row.costPrice);
              const regularMargin = margin(row.regularPrice, row.costPrice);
              const isEditing = editing === row.id;
              const previewMargin = isEditing ? margin(row.sellingPrice, draftCost) : null;
              return (
                <li key={row.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 items-center gap-3 lg:w-80">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {row.image ? <img src={row.image} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{row.name}</p>
                        <p className="truncate text-xs text-gray-500">{[row.sku, row.category, `${row.stock ?? 0} in stock`, `${row.unitsSold30d} sold in 30 days`].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                    <dl className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-gray-500">Supplier cost</dt>
                        <dd className="font-semibold tabular-nums">{row.costPrice == null ? '—' : cedis(row.costPrice)}</dd>
                        {row.supplierName && <dd className="truncate text-xs text-gray-500">{row.supplierName}</dd>}
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">{row.onPromotion ? 'Selling now' : 'Selling price'}</dt>
                        <dd className="font-semibold tabular-nums">{row.sellingPrice > 0 ? cedis(row.sellingPrice) : 'No price'}</dd>
                        {row.onPromotion && <dd className="text-xs text-gray-500 line-through tabular-nums">{cedis(row.regularPrice)}</dd>}
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Profit per item</dt>
                        <dd className={`font-semibold tabular-nums ${marginTone(sellingMargin)}`}>{row.costPrice == null || row.sellingPrice <= 0 ? '—' : cedis(row.sellingPrice - row.costPrice)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Margin</dt>
                        <dd className={`text-lg font-bold tabular-nums ${marginTone(sellingMargin)}`}>{sellingMargin == null ? '—' : `${sellingMargin.toFixed(1)}%`}</dd>
                        {row.onPromotion && regularMargin != null && <dd className="text-xs text-gray-500">{regularMargin.toFixed(1)}% at full price</dd>}
                      </div>
                    </dl>
                    {!isEditing && (
                      <button type="button" onClick={() => startEdit(row)} className={`self-start rounded-lg px-4 py-2 text-sm font-semibold lg:self-center ${row.costPrice == null ? 'bg-rose-700 text-white' : 'border border-gray-200 text-gray-700'}`}>
                        {row.costPrice == null ? 'Add cost' : 'Edit'}
                      </button>
                    )}
                  </div>
                  {isEditing && (
                    <form onSubmit={(e) => { e.preventDefault(); void save(row); }} className="mt-4 grid gap-3 rounded-xl bg-rose-50 p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                      <label className="block"><span className="mb-1 block text-xs font-medium">Supplier cost (GH₵)</span><input autoFocus inputMode="decimal" type="number" min="0" step="0.01" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} className={field} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium">Supplier</span><input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} className={field} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium">Notes</span><input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={field} placeholder="Bought in packs of 6" /></label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm">Cancel</button>
                        <button disabled={saving} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                      </div>
                      {previewMargin != null && draftCost != null && (
                        <p className={`text-sm font-medium sm:col-span-4 ${marginTone(previewMargin)}`}>
                          At {cedis(row.sellingPrice)} you make {cedis(row.sellingPrice - draftCost)} per item, a {previewMargin.toFixed(1)}% margin.
                        </p>
                      )}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
