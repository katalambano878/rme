'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import BulkDiscountPanel from '@/components/admin/BulkDiscountPanel';

export default function AdminSalesPage() {
  const [salePromotionOn, setSalePromotionOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('site_settings').select('feature_flags').eq('id', 1).maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {};
          setSalePromotionOn(flags.sale_promotion_enabled === true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setSalePromotionOn(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSalePromotion = async () => {
    const next = !salePromotionOn;
    try {
      setSaving(true);
      const { data: row, error: fetchErr } = await supabase.from('site_settings').select('feature_flags').eq('id', 1).maybeSingle();
      if (fetchErr) throw fetchErr;
      const flags = { ...((row?.feature_flags as Record<string, unknown> | null) ?? {}), sale_promotion_enabled: next };
      const { error: upErr } = await supabase.from('site_settings').update({ feature_flags: flags }).eq('id', 1);
      if (upErr) throw upErr;
      setSalePromotionOn(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      if (/permission|policy|RLS|42501/i.test(msg)) {
        alert('Only an admin can change this setting. Ask a store admin to update Sale / promotion.');
      } else {
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
        <p className="text-gray-600 mt-1">
          Store-wide sale mode and bulk discounts. Product prices and optional <strong>Sales (GH₵)</strong> amounts are set per product under{' '}
          <strong>Pricing &amp; Inventory</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border-2 border-rose-100 bg-[#FFF5F5]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Sale / promotion</p>
          <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
            When on, the store can treat promotional pricing according to your theme and product metadata. Configure individual list, compare-at, and
            sales amounts on each product.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={salePromotionOn}
            disabled={loading || saving}
            onClick={toggleSalePromotion}
            className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 disabled:opacity-50 ${
              salePromotionOn ? 'bg-rose-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow ring-0 transition ${
                salePromotionOn ? 'translate-x-7' : 'translate-x-0.5'
              }`}
            />
          </button>
          <Link
            href="/admin/products"
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Go to products
          </Link>
        </div>
      </div>

      <div className="p-4 rounded-xl border-2 border-rose-100 bg-[#FFF5F5]">
        <p className="text-sm font-semibold text-gray-900">Shipping / delivery</p>
        <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
          Checkout does not charge shipping. Confirm the delivery cost with each customer after they place an order.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading sale settings…</p>}

      <BulkDiscountPanel />
    </div>
  );
}
