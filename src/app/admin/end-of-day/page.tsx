'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-api';

type Report = {
  day: string;
  totals: {
    paidOrders: number;
    unpaidOrders: number;
    cancelledOrders: number;
    posOrders: number;
    webOrders: number;
    revenue: number;
    posRevenue: number;
    webRevenue: number;
    discounts: number;
    toFulfil: number;
  };
  payments: { method: string; channel: string; orders: number; revenue: number }[];
  products: { name: string; quantity: number; revenue: number }[];
};

export default function EndOfDayPage() {
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' }));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (date: string) => {
    try {
      setReport(await adminFetch<Report>(`/api/admin/end-of-day?date=${date}`));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the day.');
    }
  }, []);

  useEffect(() => { void load(day); }, [day, load]);

  const t = report?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">End of day</h1>
          <p className="mt-1 text-gray-600">Paid sales, website against the counter, and what still needs packing.</p>
        </div>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" />
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {t && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Revenue', cedis(t.revenue)],
            ['Website', cedis(t.webRevenue)],
            ['POS', cedis(t.posRevenue)],
            ['Still to pack', String(t.toFulfil)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-rose-100 bg-white p-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}
      {t && (
        <p className="text-sm text-gray-600">
          {t.paidOrders} paid · {t.webOrders} website · {t.posOrders} counter · {t.unpaidOrders} unpaid · {t.cancelledOrders} cancelled · discounts {cedis(t.discounts)}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-rose-100 bg-white p-4">
          <h2 className="font-semibold text-gray-900">How they paid</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {(report?.payments ?? []).map((row) => (
              <li key={`${row.channel}-${row.method}`} className="flex justify-between py-2">
                <span>{row.channel} · {row.method}</span>
                <span>{row.orders} · {cedis(row.revenue)}</span>
              </li>
            ))}
            {!report?.payments.length && <li className="py-4 text-gray-500">No paid orders this day.</li>}
          </ul>
        </section>
        <section className="rounded-xl border border-rose-100 bg-white p-4">
          <h2 className="font-semibold text-gray-900">What sold</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {(report?.products ?? []).map((row) => (
              <li key={row.name} className="flex justify-between gap-3 py-2">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0">{row.quantity} · {cedis(row.revenue)}</span>
              </li>
            ))}
            {!report?.products.length && <li className="py-4 text-gray-500">Nothing sold this day.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
