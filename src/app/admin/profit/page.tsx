'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-api';

type Row = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  image: string | null;
  stock: number;
  sellingPrice: number | null;
  costPrice: number | null;
  supplierName: string;
  notes: string;
  unitsSold30d: number;
};

export default function ProfitPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ products: Row[] }>('/api/admin/profit');
      setRows(data.products);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profit.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || `${r.name} ${r.sku || ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  async function save(row: Row) {
    const raw = drafts[row.id] ?? (row.costPrice == null ? '' : String(row.costPrice));
    try {
      await adminFetch('/api/admin/profit', {
        method: 'PUT',
        body: JSON.stringify({ productId: row.id, costPrice: raw.trim() === '' ? null : Number(raw), supplierName: row.supplierName, notes: row.notes }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save cost.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profit margins</h1>
        <p className="mt-1 text-gray-600">Enter what you paid. The margin is the selling price minus that cost. Products with no selling price stay blank.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2" />
      <div className="overflow-hidden rounded-xl border border-rose-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-rose-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Sells for</th>
              <th className="px-4 py-3">Your cost</th>
              <th className="px-4 py-3">Margin</th>
              <th className="px-4 py-3">Sold 30d</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const costText = drafts[row.id] ?? (row.costPrice == null ? '' : String(row.costPrice));
              const cost = costText.trim() === '' ? null : Number(costText);
              const margin = row.sellingPrice != null && cost != null && Number.isFinite(cost) ? row.sellingPrice - cost : null;
              const pct = margin != null && row.sellingPrice ? Math.round((margin / row.sellingPrice) * 100) : null;
              return (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-500">{row.category} · stock {row.stock}</p>
                  </td>
                  <td className="px-4 py-3">{row.sellingPrice == null ? 'No price' : cedis(row.sellingPrice)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <input
                        value={costText}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        className="w-24 rounded border border-gray-300 px-2 py-1"
                        inputMode="decimal"
                        placeholder="Cost"
                      />
                      <button type="button" onClick={() => void save(row)} className="rounded bg-rose-600 px-3 py-1 text-white">Save</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">{margin == null ? '—' : `${cedis(margin)}${pct != null ? ` (${pct}%)` : ''}`}</td>
                  <td className="px-4 py-3">{row.unitsSold30d}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
