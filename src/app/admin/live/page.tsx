'use client';

import { useEffect, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-api';

type Session = { id: string; page: string; stage: string; cartItems: number; cartValue: number; lastSeen: string };
type LiveData = {
  windowSeconds: number;
  online: number;
  withBag: number;
  atCheckout: number;
  bagValue: number;
  today: { visitors: number; webOrders: number; webRevenue: number };
  sessions: Session[];
};

const STAGES: Record<string, string> = {
  checkout: 'At checkout',
  cart: 'Looking at bag',
  has_bag: 'Shopping with items',
  viewing_product: 'Viewing a product',
  browsing: 'Browsing',
};

function pageName(path: string) {
  if (path === '/') return 'Home';
  if (path.startsWith('/products/')) return path.split('/')[2]?.replace(/-/g, ' ') || 'Product';
  return path;
}

export default function LiveShoppersPage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // State is only set from the request's callbacks, never in the effect body.
    const load = () =>
      adminFetch<LiveData>('/api/live')
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setError('');
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load live shoppers.');
        });
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const cards = [
    ['On the website now', data?.online ?? '—'],
    ['With a bag', data?.withBag ?? '—'],
    ['At checkout', data?.atCheckout ?? '—'],
    ['Website orders today', data?.today.webOrders ?? '—'],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live shoppers</h1>
        <p className="text-gray-600 mt-1">People on the store in the last {data?.windowSeconds ?? 90} seconds. Refreshes every 15 seconds.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 text-red-800 p-3 text-sm">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-rose-100 bg-white p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      {data && (
        <p className="text-sm text-gray-600">
          Open bags {cedis(data.bagValue)} · today {data.today.visitors} visitors · {cedis(data.today.webRevenue)} website sales
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-rose-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-rose-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Shopper</th>
              <th className="px-4 py-3">Where</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Bag</th>
            </tr>
          </thead>
          <tbody>
            {(data?.sessions ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nobody is on the site right now.</td></tr>
            ) : data?.sessions.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{row.id}</td>
                <td className="px-4 py-3">{pageName(row.page)}</td>
                <td className="px-4 py-3">{STAGES[row.stage] || row.stage}</td>
                <td className="px-4 py-3">{row.cartItems ? `${row.cartItems} · ${cedis(row.cartValue)}` : 'Empty'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
