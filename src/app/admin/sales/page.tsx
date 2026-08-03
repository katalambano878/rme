'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BulkDiscountPanel from '@/components/admin/BulkDiscountPanel';

export default function AdminSalesPage() {
  const [salePromotionOn, setSalePromotionOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('25');
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ feature_flags: Record<string, unknown> }>('/api/admin/settings');
        if (!cancelled) {
          const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {};
          setSalePromotionOn(flags.sale_promotion_enabled === true);
          if (typeof flags.delivery_fee === 'number') setDeliveryFee(String(flags.delivery_fee));
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

  const saveDeliveryFee = async () => {
    const fee = parseFloat(deliveryFee);
    if (isNaN(fee) || fee < 0) {
      alert('Enter a valid delivery fee (0 or higher).');
      return;
    }
    try {
      setSavingFee(true);
      await api('/api/admin/settings', {
        method: 'PATCH',
        json: { feature_flags: { delivery_fee: fee } },
      });
      alert('Delivery fee updated!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      alert(msg);
    } finally {
      setSavingFee(false);
    }
  };

  const toggleSalePromotion = async () => {
    const next = !salePromotionOn;
    try {
      setSaving(true);
      await api('/api/admin/settings', {
        method: 'PATCH',
        json: { feature_flags: { sale_promotion_enabled: next } },
      });
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border-2 border-rose-border bg-rose-light">
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
            className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2 disabled:opacity-50 ${
              salePromotionOn ? 'bg-navy' : 'bg-gray-200'
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
            className="px-4 py-2 rounded-lg bg-navy hover:bg-navy text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Go to products
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border-2 border-rose-border bg-rose-light">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Doorstep Delivery Fee (GH₵)</p>
          <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
            The amount charged for doorstep delivery at checkout. Store pickup is always free. Set to 0 for free delivery.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="number"
            min="0"
            step="0.01"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold text-center focus:ring-2 focus:ring-navy focus:border-rose-primary input-no-spinner"
          />
          <button
            type="button"
            onClick={saveDeliveryFee}
            disabled={savingFee}
            className="px-4 py-2 rounded-lg bg-navy hover:bg-navy text-white text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {savingFee ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading sale settings…</p>}

      <BulkDiscountPanel />
    </div>
  );
}
