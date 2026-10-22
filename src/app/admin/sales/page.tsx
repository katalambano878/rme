'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ProductMarkdowns from '@/components/admin/ProductMarkdowns';
import { supabase } from '@/lib/supabase';
import { parseStorePricing, storePricingToFlags } from '@/lib/effective-price';

/**
 * Two mutually exclusive pricing modes, stored in site_settings.feature_flags:
 *
 *  - Sale-price mode:  sales_active, no percent
 *      → each product shows its own Sale price; products without one keep regular price.
 *  - Bulk-discount mode: sales_active + percent + strict
 *      → N% off the REGULAR price of every product; per-product sale prices are ignored.
 *  - Everything off
 */
function StoreWidePricing({ onShowProducts }: { onShowProducts: () => void }) {
  const [salesActive, setSalesActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [strictDiscount, setStrictDiscount] = useState(false);
  const [customDiscount, setCustomDiscount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [markdownCount, setMarkdownCount] = useState(0);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, metadata')
      .then(({ data }) =>
        setMarkdownCount((data || []).filter((p: { metadata?: { discount?: unknown } }) => p.metadata?.discount).length),
      );
  }, []);

  const saleMode = salesActive && !strictDiscount;
  const bulkMode = salesActive && strictDiscount;

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('site_settings')
        .select('feature_flags')
        .eq('id', 1)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setSalesActive(false);
        setDiscountPercent(0);
        setStrictDiscount(false);
        return;
      }

      const parsed = parseStorePricing(data?.feature_flags);
      setSalesActive(parsed.salesActive);
      setDiscountPercent(parsed.discountPercent);
      setStrictDiscount(parsed.strictDiscount);
      if (parsed.discountPercent > 0) {
        setCustomDiscount(String(parsed.discountPercent));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (
    next: { salesActive: boolean; discountPercent: number; strictDiscount: boolean },
    message: string,
  ) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('site_settings')
        .select('feature_flags')
        .eq('id', 1)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const flags = storePricingToFlags(next, (row?.feature_flags as Record<string, unknown> | null) ?? {});
      const { error: upErr } = await supabase.from('site_settings').update({ feature_flags: flags }).eq('id', 1);
      if (upErr) throw upErr;
      setSalesActive(next.salesActive);
      setDiscountPercent(next.discountPercent);
      setStrictDiscount(next.strictDiscount);
      if (next.discountPercent > 0) {
        setCustomDiscount(String(next.discountPercent));
      }
      setSuccess(message);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      if (/permission|policy|RLS|42501/i.test(msg)) {
        setError('Only an admin can change this setting.');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaleToggle = () => {
    if (saleMode) {
      void saveSettings(
        { salesActive: false, discountPercent: 0, strictDiscount: false },
        'Store-wide sale turned OFF — regular prices everywhere',
      );
    } else {
      void saveSettings(
        { salesActive: true, discountPercent: 0, strictDiscount: false },
        'Store-wide sale ON — per-product sale prices are now showing',
      );
    }
  };

  const activateBulk = (percent: number) => {
    void saveSettings(
      { salesActive: true, discountPercent: percent, strictDiscount: true },
      `Bulk discount ON — every product now shows ${percent}% off its regular price`,
    );
  };

  const handleBulkToggle = () => {
    if (bulkMode) {
      void saveSettings(
        { salesActive: false, discountPercent: 0, strictDiscount: false },
        'Bulk discount turned OFF — regular prices everywhere',
      );
      return;
    }
    const pct = discountPercent > 0 ? discountPercent : parseFloat(customDiscount);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Pick a percentage first (use a preset or the custom box), then turn this on.');
      return;
    }
    activateBulk(Math.round(pct * 100) / 100);
  };

  const handleCustomDiscountSubmit = () => {
    const val = parseFloat(customDiscount);
    if (isNaN(val) || val <= 0 || val > 100) {
      setError('Please enter a valid percentage between 1 and 100');
      return;
    }
    activateBulk(Math.round(val * 100) / 100);
  };

  const presetDiscounts = [10, 15, 20, 25, 30, 50];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        <i className="ri-loader-4-line text-3xl animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-gray-600">
        Two ways to discount the whole store — <strong>only one can be on at a time</strong>. Turning one on automatically
        turns the other off.
      </p>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-100">{error}</div>}
      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-100 text-green-800 text-sm flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-green-600" />
          {success}
        </div>
      )}

      {markdownCount > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
          <i className="ri-error-warning-line text-lg" />
          <p>
            {markdownCount} product{markdownCount === 1 ? ' is' : 's are'} already marked down under{' '}
            <button type="button" onClick={onShowProducts} className="font-semibold underline">
              Selected products
            </button>
            . Turning on a whole-store sale would discount
            {markdownCount === 1 ? ' it' : ' them'} twice, so end those markdowns first.
          </p>
        </div>
      )}

      <div
        className={`rounded-xl border p-4 text-sm font-medium flex items-center gap-2 ${
          bulkMode
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : saleMode
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}
      >
        <i
          className={
            bulkMode ? 'ri-percent-fill text-lg' : saleMode ? 'ri-price-tag-3-fill text-lg' : 'ri-pause-circle-line text-lg'
          }
        />
        {bulkMode
          ? `BULK DISCOUNT is running: ${discountPercent}% off the regular price of every product.`
          : saleMode
            ? 'STORE-WIDE SALE is running: products show their own sale prices.'
            : 'No promotion running — all products show regular prices.'}
      </div>

      <div
        className={`bg-white rounded-xl border-2 shadow-sm p-6 transition-colors ${
          saleMode ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-price-tag-3-line text-red-500" />
              Store-wide sale
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Shows each product&apos;s <strong>Sale price</strong> (set per product in Products → Pricing &amp;
              Inventory) instead of the regular price. Products without a sale price keep their regular price.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaleToggle}
            className={`relative inline-flex h-10 w-[3.5rem] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              saleMode ? 'bg-red-600' : 'bg-gray-300'
            } ${saving ? 'opacity-60 cursor-wait' : ''}`}
            role="switch"
            aria-checked={saleMode}
          >
            <span
              className={`pointer-events-none inline-block h-9 w-9 transform rounded-full bg-white shadow ring-0 transition ${
                saleMode ? 'translate-x-[1.4rem]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {bulkMode && (
          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-4">
            Bulk discount is currently running. Turning this on will switch it off.
          </p>
        )}
      </div>

      <div
        className={`bg-white rounded-xl border-2 shadow-sm p-6 transition-colors ${
          bulkMode ? 'border-rose-300' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-percent-line text-rose-500" />
              Bulk percentage discount
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Takes a flat percentage off the <strong>Regular price of every product</strong>. Ignores per-product sale
              prices completely — one clean discount on everything. Turning it off puts every price back.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {bulkMode && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-rose-100 text-rose-800">
                {discountPercent}% OFF
              </span>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleBulkToggle}
              className={`relative inline-flex h-10 w-[3.5rem] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${
                bulkMode ? 'bg-rose-600' : 'bg-gray-300'
              } ${saving ? 'opacity-60 cursor-wait' : ''}`}
              role="switch"
              aria-checked={bulkMode}
            >
              <span
                className={`pointer-events-none inline-block h-9 w-9 transform rounded-full bg-white shadow ring-0 transition ${
                  bulkMode ? 'translate-x-[1.4rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {saleMode && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5 mt-4">
            Store-wide sale is currently running. Picking a percentage below will switch it off.
          </p>
        )}

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Quick presets — tap to apply instantly</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {presetDiscounts.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={saving}
                  onClick={() => activateBulk(pct)}
                  className={`px-3 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                    bulkMode && discountPercent === pct
                      ? 'bg-rose-700 text-white border-rose-700 shadow-md scale-[1.02]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-rose-400 hover:bg-rose-50'
                  } ${saving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Custom percentage</p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-[200px]">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomDiscountSubmit();
                  }}
                  placeholder="e.g. 12"
                  className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
              </div>
              <button
                type="button"
                disabled={saving || !customDiscount}
                onClick={handleCustomDiscountSubmit}
                className="px-5 py-3 bg-rose-700 text-white rounded-xl font-semibold text-sm hover:bg-rose-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {saving ? <i className="ri-loader-4-line animate-spin" /> : 'Apply'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <strong>Example at 50%:</strong> a product with a regular price of GH₵40.00 becomes GH₵20.00 — even if it has
            its own sale price of GH₵35.00. The crossed-out &ldquo;was&rdquo; price customers see is always the regular
            price. Nothing is rewritten in the catalog, so turning this off restores every price.
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Tip: After changing anything here, refresh the storefront if you have it open. Checkout and the POS always charge
        using the rule that is active at that moment.
      </p>
    </div>
  );
}

const TABS = [
  { key: 'store', label: 'Whole store', icon: 'ri-store-2-line', hint: 'Sale prices or one percentage off everything' },
  { key: 'products', label: 'Selected products', icon: 'ri-checkbox-multiple-line', hint: 'Mark down only the products you pick' },
] as const;

function SaleAndDiscounts() {
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') === 'products' ? 'products' : 'store';
  const show = (key: string) => router.replace(key === 'store' ? pathname : `${pathname}?tab=${key}`, { scroll: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sale &amp; discounts</h1>
        <p className="text-gray-600 mt-1">
          Shoppers see the old price crossed out. Stopping a sale brings every price back exactly.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => show(t.key)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              tab === t.key ? 'border-rose-600 bg-rose-50 ring-1 ring-rose-600' : 'border-gray-200 bg-white hover:border-rose-300'
            }`}
          >
            <i className={`${t.icon} text-xl ${tab === t.key ? 'text-rose-700' : 'text-gray-400'}`} />
            <span>
              <span className={`block font-semibold ${tab === t.key ? 'text-rose-900' : 'text-gray-900'}`}>{t.label}</span>
              <span className="block text-xs text-gray-500">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {tab === 'store' ? <StoreWidePricing onShowProducts={() => show('products')} /> : <ProductMarkdowns />}
    </div>
  );
}

export default function AdminSalesPage() {
  return (
    <Suspense>
      <SaleAndDiscounts />
    </Suspense>
  );
}
