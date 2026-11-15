'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-api';

type Report = {
  day: string;
  summary: {
    paidOrders: number; unpaidOrders: number; cancelledOrders: number; posOrders: number; webOrders: number;
    revenue: number; posRevenue: number; webRevenue: number; discounts: number; toFulfil: number;
    unitsSold: number; averageOrder: number; profit: number | null; profitCoverage: number;
  };
  comparison: { yesterday: number; lastWeek: number };
  payments: { method: string; channel: string; orders: number; revenue: number }[];
  items: { productId: string | null; name: string; units: number; posUnits: number; webUnits: number; revenue: number; stockLeft: number | null; profit: number | null }[];
  lowStock: { name: string; stockLeft: number | null }[];
  staff: { name: string; orders: number; revenue: number; units: number }[];
  orders: { id: string; order_number: string; total: number; payment_status: string; payment_method: string | null; status: string; created_at: string; staff_name: string | null; channel: string; customer: string }[];
};

const METHOD_LABELS: Record<string, string> = { cash: 'Cash', card: 'Card', momo: 'Mobile Money', moolre: 'Mobile Money', paystack: 'Paystack', other: 'Other' };

function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' }); }
function change(now: number, before: number) { return before ? Math.round(((now - before) / before) * 100) : null; }

export default function EndOfDayPage() {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      setReport(await adminFetch<Report>(`/api/admin/end-of-day?date=${day}`));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  const s = report?.summary;
  const vsYesterday = s && report ? change(s.revenue, report.comparison.yesterday) : null;
  const webShare = s && s.revenue ? Math.round((s.webRevenue / s.revenue) * 100) : 0;
  const prettyDay = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">End of Day</h1>
          <p className="mt-1 text-gray-600">{prettyDay} · sales, stock movement, website vs POS</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => setDate(today())} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">Today</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Print close</button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {loading && !report ? <p className="py-16 text-center text-gray-500">Loading…</p> : s && report ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl bg-rose-700 p-6 text-white">
              <p className="text-sm text-rose-100">Paid sales</p>
              <p className="mt-2 text-4xl font-bold tabular-nums">{cedis(s.revenue)}</p>
              <p className="mt-2 text-sm text-rose-100">
                {s.paidOrders} paid order{s.paidOrders === 1 ? '' : 's'} · {s.unitsSold} item{s.unitsSold === 1 ? '' : 's'} sold
                {vsYesterday != null && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{vsYesterday >= 0 ? '+' : ''}{vsYesterday}% vs yesterday</span>}
              </p>
            </div>
            <Stat label="Average order" value={cedis(s.averageOrder)} />
            <Stat label="Profit (where cost is known)" value={s.profit == null ? '—' : cedis(s.profit)} hint={s.profit == null ? 'Add supplier costs on Profit margins' : `${Math.round(s.profitCoverage * 100)}% of items have a cost`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
              <h2 className="font-semibold text-gray-900">Website vs POS</h2>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-rose-100"><div className="h-full bg-rose-700" style={{ width: `${webShare}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Channel label="Website" revenue={s.webRevenue} orders={s.webOrders} />
                <Channel label="POS (in store)" revenue={s.posRevenue} orders={s.posOrders} />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="font-semibold text-gray-900">Still to do</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between"><Link href="/admin/orders">Paid, not yet sent out</Link><b>{s.toFulfil}</b></li>
                <li className="flex justify-between"><span>Waiting for payment</span><b>{s.unpaidOrders}</b></li>
                <li className="flex justify-between"><span>Cancelled</span><b>{s.cancelledOrders}</b></li>
                <li className="flex justify-between"><span>Discounts given</span><b>{cedis(s.discounts)}</b></li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Sales by staff (POS)">
              {report.staff.length ? (
                <table className="w-full text-sm"><tbody>
                  {report.staff.map((row) => (
                    <tr key={row.name} className="border-t border-gray-100"><td className="py-2 font-medium">{row.name}</td><td className="py-2 text-right">{row.orders} orders</td><td className="py-2 text-right">{row.units} items</td><td className="py-2 text-right font-semibold">{cedis(row.revenue)}</td></tr>
                  ))}
                </tbody></table>
              ) : <Empty>No POS sales on this day.</Empty>}
            </Card>
            <Card title="How customers paid">
              {report.payments.length ? (
                <ul className="divide-y divide-gray-100 text-sm">
                  {report.payments.map((row) => (
                    <li key={row.method + row.channel} className="flex justify-between py-2">
                      <span>{METHOD_LABELS[row.method] || row.method} <span className="rounded-full bg-gray-100 px-2 text-xs">{row.channel}</span></span>
                      <span>{row.orders}× {cedis(row.revenue)}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No payments on this day.</Empty>}
            </Card>
          </div>

          <Card title="Stock movement">
            {report.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500"><tr><th className="py-2">Product</th><th className="py-2 text-right">Website</th><th className="py-2 text-right">POS</th><th className="py-2 text-right">Total out</th><th className="py-2 text-right">Stock left</th><th className="py-2 text-right">Sales</th>{s.profit != null && <th className="py-2 text-right">Profit</th>}</tr></thead>
                  <tbody>
                    {report.items.map((item) => (
                      <tr key={(item.productId || '') + item.name} className="border-t border-gray-100">
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2 text-right">{item.webUnits}</td>
                        <td className="py-2 text-right">{item.posUnits}</td>
                        <td className="py-2 text-right font-semibold">−{item.units}</td>
                        <td className={`py-2 text-right ${item.stockLeft != null && item.stockLeft <= 5 ? 'font-semibold text-red-600' : ''}`}>{item.stockLeft ?? '—'}</td>
                        <td className="py-2 text-right">{cedis(item.revenue)}</td>
                        {s.profit != null && <td className="py-2 text-right">{item.profit == null ? '—' : cedis(item.profit)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.lowStock.length > 0 && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Running low after today: {report.lowStock.map((item) => `${item.name} (${item.stockLeft})`).join(', ')}</p>}
              </div>
            ) : <Empty>Nothing sold on this day.</Empty>}
          </Card>

          <Card title={`All orders (${report.orders.length})`}>
            {report.orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500"><tr><th className="py-2">Time</th><th className="py-2">Order</th><th className="py-2">Customer</th><th className="py-2">Channel</th><th className="py-2">Payment</th><th className="py-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {report.orders.map((order) => (
                      <tr key={order.id} className="border-t border-gray-100">
                        <td className="py-2 text-gray-600">{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' })}</td>
                        <td className="py-2"><Link href={`/admin/orders/${order.id}`} className="font-medium text-rose-700">{order.order_number}</Link></td>
                        <td className="py-2">{order.customer || 'Walk-in'}</td>
                        <td className="py-2">{order.channel}</td>
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${order.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{order.payment_status}</span></td>
                        <td className="py-2 text-right font-semibold">{cedis(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>No orders on this day.</Empty>}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6"><p className="text-sm text-gray-600">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}</div>;
}
function Channel({ label, revenue, orders }: { label: string; revenue: number; orders: number }) {
  return <div><p className="text-sm text-gray-600">{label}</p><p className="font-bold tabular-nums">{cedis(revenue)}</p><p className="text-xs text-gray-500">{orders} paid order{orders === 1 ? '' : 's'}</p></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="mb-3 font-semibold text-gray-900">{title}</h2>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500">{children}</p>;
}
