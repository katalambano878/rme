'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { applyBulkDiscountPercent } from '@/lib/admin-bulk-sale';

type BulkDiscountPanelProps = {
  /** After a successful apply, e.g. refetch products on the Products page */
  onApplied?: () => void;
};

export default function BulkDiscountPanel({ onApplied }: BulkDiscountPanelProps) {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [bulkDiscountBusy, setBulkDiscountBusy] = useState(false);
  const [bulkScope, setBulkScope] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [bulkCustomPercent, setBulkCustomPercent] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingList(true);
        const data = await api<{ id: string; name: string }[]>('/api/catalog/products');
        if (!cancelled && data) {
          setProducts(data.map((p) => ({ id: p.id, name: p.name ?? '' })));
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, pickerSearch]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      filteredPicker.forEach((p) => set.add(p.id));
      return [...set];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const runBulk = async (percent: number) => {
    const scope = bulkScope;
    if (scope === 'selected' && selectedIds.length === 0) {
      alert('Select at least one product below, or choose “All products”.');
      return;
    }
    const label =
      scope === 'all'
        ? `all ${products.length} product(s)`
        : `${selectedIds.length} selected product(s)`;
    if (
      !confirm(
        `Apply ${percent}% off to ${label}? Each item uses its current list price (or crossed-out price if already on sale) as the regular price, then sets the sale price.`,
      )
    ) {
      return;
    }
    try {
      setBulkDiscountBusy(true);
      const { updated, errors } = await applyBulkDiscountPercent(percent, {
        scope,
        selectedIds: scope === 'selected' ? selectedIds : undefined,
      });
      if (errors.length) {
        alert(
          `Updated ${updated} product(s). Some errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…' : ''}`,
        );
      } else {
        alert(`Sale pricing applied to ${updated} product(s).`);
      }
      onApplied?.();
    } catch (e: unknown) {
      alert(`Bulk discount failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBulkDiscountBusy(false);
    }
  };

  const handleBulkDiscountCustom = () => {
    const raw = bulkCustomPercent.trim().replace(',', '.');
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
      alert('Enter a discount between 1% and 99%.');
      return;
    }
    void runBulk(Math.round(pct * 100) / 100);
  };

  const selectionBlocked = bulkScope === 'selected' && selectedIds.length === 0;

  return (
    <div className="bg-white rounded-xl border border-rose-border shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Bulk discount</h2>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Apply the same percentage off every product’s current list price (the amount shown as full price, or the
          crossed-out price if the item is already on sale). Variant prices are updated so the storefront sale badges
          stay correct.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold text-gray-800">Apply to:</span>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="bulkScopeSales"
            checked={bulkScope === 'all'}
            onChange={() => setBulkScope('all')}
            className="text-navy focus:ring-navy"
          />
          All products ({loadingList ? '…' : products.length})
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="bulkScopeSales"
            checked={bulkScope === 'selected'}
            onChange={() => setBulkScope('selected')}
            className="text-navy focus:ring-navy"
          />
          Selected only ({selectedIds.length})
        </label>
      </div>

      {bulkScope === 'selected' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <p className="text-sm font-medium text-gray-800">Choose products</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-xs font-semibold text-navy hover:text-navy cursor-pointer"
              >
                Select all in list
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
          <input
            type="search"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-rose-primary"
          />
          <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
            {loadingList ? (
              <p className="p-4 text-sm text-gray-500">Loading products…</p>
            ) : filteredPicker.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No products match.</p>
            ) : (
              filteredPicker.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-rose-light cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleId(p.id)}
                    className="w-4 h-4 text-navy border-gray-300 rounded focus:ring-navy"
                  />
                  <span className="text-gray-900 truncate">{p.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {[10, 20, 30, 40].map((pct) => (
            <button
              key={pct}
              type="button"
              disabled={bulkDiscountBusy || selectionBlocked}
              onClick={() => runBulk(pct)}
              className="px-4 py-2 rounded-lg bg-navy hover:bg-navy disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {`${pct}% off`}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 pt-2 border-t border-rose-border">
          <div className="flex-1 min-w-[140px] max-w-xs">
            <label
              htmlFor="bulk-custom-pct-sales"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5"
            >
              Custom discount (%)
            </label>
            <input
              id="bulk-custom-pct-sales"
              type="number"
              inputMode="decimal"
              min={1}
              max={99}
              step="any"
              placeholder="e.g. 15"
              value={bulkCustomPercent}
              onChange={(e) => setBulkCustomPercent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBulkDiscountCustom();
              }}
              disabled={bulkDiscountBusy}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary text-sm disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={bulkDiscountBusy || selectionBlocked || !bulkCustomPercent.trim()}
            onClick={handleBulkDiscountCustom}
            className="px-4 py-2 rounded-lg border-2 border-navy text-navy hover:bg-rose-light disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Apply custom %
          </button>
        </div>
      </div>
    </div>
  );
}
