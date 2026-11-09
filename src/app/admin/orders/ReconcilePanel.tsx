'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import type { ReconcileResult, ReconcileVerdict } from '@/lib/order-reconcile';

/** The order fields this panel needs from the orders page. */
export interface ReconcileCandidate {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  payment_status: string;
  is_confirmed: boolean;
}

type Period = '7d' | '30d' | '90d' | 'all';
type Phase = 'idle' | 'checking' | 'checked' | 'confirming' | 'done';

const PERIOD_LABEL: Record<Period, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', all: 'All time' };
const PERIOD_DAYS: Record<Period, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };
const BATCH = 20;

interface ConfirmOutcome {
  orderId: string;
  orderNumber: string;
  ok: boolean;
  message: string;
}

export default function ReconcilePanel({
  isOpen,
  onClose,
  orders,
  customerName,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  orders: ReconcileCandidate[];
  customerName: (orderId: string) => string;
  onChanged: () => Promise<void> | void;
}) {
  const [period, setPeriod] = useState<Period>('30d');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ReconcileResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(false);
  const [outcomes, setOutcomes] = useState<ConfirmOutcome[]>([]);
  const [error, setError] = useState('');
  // Period cut-offs are measured from when the panel was mounted.
  const [now] = useState(() => Date.now());

  // Every order without a recorded payment: abandoned carts, plus confirmed
  // orders that were moved on by hand but never had a payment saved.
  const candidates = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const since = days ? now - days * 86_400_000 : 0;
    return orders.filter((o) => o.payment_status !== 'paid' && new Date(o.created_at).getTime() >= since);
  }, [orders, period, now]);
  const abandonedCount = candidates.filter((o) => !o.is_confirmed).length;

  const byVerdict = useMemo(() => {
    const groups: Record<ReconcileVerdict, ReconcileResult[]> = {
      paid_not_recorded: [], amount_mismatch: [], unpaid: [], unknown: [], already_paid: [], pos: [],
    };
    for (const r of results) groups[r.verdict].push(r);
    return groups;
  }, [results]);
  const missingPayment = byVerdict.unpaid.filter((r) => r.shownAs === 'confirmed');
  const trulyAbandoned = byVerdict.unpaid.filter((r) => r.shownAs === 'abandoned');

  if (!isOpen) return null;

  const reset = () => {
    setPhase('idle');
    setResults([]);
    setSelected(new Set());
    setOutcomes([]);
    setError('');
  };

  const close = () => {
    if (phase === 'checking' || phase === 'confirming') return;
    reset();
    onClose();
  };

  const runCheck = async () => {
    setError('');
    setPhase('checking');
    setResults([]);
    setProgress({ done: 0, total: candidates.length });
    const collected: ReconcileResult[] = [];
    try {
      for (let i = 0; i < candidates.length; i += BATCH) {
        const ids = candidates.slice(i, i + BATCH).map((o) => o.id);
        const { results: batch } = await adminFetch<{ results: ReconcileResult[] }>('/api/admin/orders/reconcile', {
          method: 'POST',
          body: JSON.stringify({ action: 'check', orderIds: ids }),
        });
        collected.push(...batch);
        setResults([...collected]);
        setProgress({ done: Math.min(i + BATCH, candidates.length), total: candidates.length });
      }
      setSelected(new Set(collected.filter((r) => r.verdict === 'paid_not_recorded').map((r) => r.orderId)));
      setPhase('checked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check stopped part-way. Try again.');
      setPhase(collected.length > 0 ? 'checked' : 'idle');
    }
  };

  const runConfirm = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setError('');
    setPhase('confirming');
    setProgress({ done: 0, total: ids.length });
    const done: ConfirmOutcome[] = [];
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const { confirmed } = await adminFetch<{ confirmed: ConfirmOutcome[] }>('/api/admin/orders/reconcile', {
          method: 'POST',
          body: JSON.stringify({ action: 'confirm', orderIds: ids.slice(i, i + BATCH), notify }),
        });
        done.push(...confirmed);
        setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Some orders could not be confirmed. Try again.');
    }
    setOutcomes(done);
    setPhase('done');
    await onChanged();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const busy = phase === 'checking' || phase === 'confirming';
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reconcile-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start gap-4 bg-gray-50/50">
          <div>
            <h2 id="reconcile-title" className="text-xl font-bold text-gray-900">Reconcile payments</h2>
            <p className="text-sm text-gray-500 mt-1">
              Asks Moolre which unpaid orders were actually paid, so no paid order stays in Abandoned Carts.
            </p>
          </div>
          <button
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {(phase === 'idle' || phase === 'checking') && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    disabled={busy}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                      period === p ? 'border-rose-500 bg-pink-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {PERIOD_LABEL[p]}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                {candidates.length === 0
                  ? 'Every order in this period already has a payment on record.'
                  : `${candidates.length} order${candidates.length === 1 ? '' : 's'} without a recorded payment: ${abandonedCount} in Abandoned Carts and ${candidates.length - abandonedCount} in Confirmed Orders. Nothing changes until you confirm.`}
              </p>
              {phase === 'checking' ? (
                <div className="space-y-2" aria-live="polite">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-rose-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-gray-500">Checking with Moolre… {progress.done} of {progress.total}</p>
                </div>
              ) : (
                <button
                  onClick={runCheck}
                  disabled={candidates.length === 0}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-search-eye-line mr-2"></i>
                  Check {candidates.length} order{candidates.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>}

          {(phase === 'checked' || phase === 'confirming') && (
            <>
              <ResultSection
                tone="green"
                icon="ri-money-dollar-circle-line"
                title={`Paid but not confirmed (${byVerdict.paid_not_recorded.length})`}
                hint="Moolre received the full amount, but the order was never marked paid. Confirming records the payment, moves the order to Confirmed and takes its stock."
                empty="None found. No paid order is missing from Confirmed Orders."
                rows={byVerdict.paid_not_recorded}
                customerName={customerName}
                selectable
                selected={selected}
                onToggle={toggle}
                disabled={busy}
              />
              {byVerdict.amount_mismatch.length > 0 && (
                <ResultSection
                  tone="amber"
                  icon="ri-error-warning-line"
                  title={`Paid a different amount (${byVerdict.amount_mismatch.length})`}
                  hint="Moolre shows a payment, but not for the order total. Check these by hand before confirming them."
                  rows={byVerdict.amount_mismatch}
                  customerName={customerName}
                />
              )}
              {missingPayment.length > 0 && (
                <ResultSection
                  tone="amber"
                  icon="ri-question-line"
                  title={`In Confirmed Orders with no payment (${missingPayment.length})`}
                  hint="These were moved on by hand, but Moolre has no payment for them. If the customer paid another way (cash, transfer), that's expected; otherwise follow up."
                  rows={missingPayment}
                  customerName={customerName}
                />
              )}
              {byVerdict.unknown.length > 0 && (
                <ResultSection
                  tone="gray"
                  icon="ri-wifi-off-line"
                  title={`Couldn't check (${byVerdict.unknown.length})`}
                  hint="Moolre didn't answer for these. Run the check again later."
                  rows={byVerdict.unknown}
                  customerName={customerName}
                />
              )}
              <p className="text-sm text-gray-500">
                {trulyAbandoned.length} abandoned order{trulyAbandoned.length === 1 ? ' is' : 's are'} genuinely unpaid: Moolre has no payment for {trulyAbandoned.length === 1 ? 'it' : 'them'}.
              </p>
            </>
          )}

          {phase === 'done' && (
            <div className="space-y-3" aria-live="polite">
              <p className="font-semibold text-gray-900">
                {outcomes.filter((o) => o.ok).length} order{outcomes.filter((o) => o.ok).length === 1 ? '' : 's'} moved to Confirmed Orders.
              </p>
              <ul className="space-y-2">
                {outcomes.map((o) => (
                  <li key={o.orderId} className={`text-sm rounded-lg p-3 border ${o.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <span className="font-semibold">{o.orderNumber}</span> · {o.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(phase === 'checked' || phase === 'confirming' || phase === 'done') && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {phase === 'done' ? (
              <>
                <button onClick={reset} className="text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer">Check again</button>
                <button onClick={close} className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer">Done</button>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} className="rounded border-gray-300 text-rose-600 focus:ring-rose-500" />
                  Also send each customer their order confirmation
                </label>
                <button
                  onClick={runConfirm}
                  disabled={busy || selected.size === 0}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {phase === 'confirming'
                    ? `Confirming… ${progress.done} of ${progress.total}`
                    : `Confirm ${selected.size} paid order${selected.size === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TONES = {
  green: 'border-green-200 bg-green-50/60 text-green-800',
  amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
  gray: 'border-gray-200 bg-gray-50 text-gray-700',
} as const;

function ResultSection({
  tone,
  icon,
  title,
  hint,
  empty,
  rows,
  customerName,
  selectable,
  selected,
  onToggle,
  disabled,
}: {
  tone: keyof typeof TONES;
  icon: string;
  title: string;
  hint: string;
  empty?: string;
  rows: ReconcileResult[];
  customerName: (orderId: string) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className={`rounded-xl border p-4 ${TONES[tone]}`}>
      <h3 className="font-semibold flex items-center gap-2"><i className={icon}></i>{title}</h3>
      <p className="text-sm mt-1 opacity-90">{hint}</p>
      {rows.length === 0 && empty ? (
        <p className="text-sm mt-3 text-gray-600">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5 bg-white rounded-lg border border-black/5">
          {rows.map((r) => (
            <li key={r.orderId} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-800">
              {selectable && (
                <input
                  type="checkbox"
                  checked={selected?.has(r.orderId) ?? false}
                  onChange={() => onToggle?.(r.orderId)}
                  disabled={disabled}
                  aria-label={`Confirm ${r.orderNumber}`}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
              )}
              <Link href={`/admin/orders/${r.orderId}`} target="_blank" className="font-semibold text-gray-900 hover:text-rose-700">
                {r.orderNumber}
              </Link>
              <span className="text-gray-500 truncate">{customerName(r.orderId)}</span>
              <span className="ml-auto text-right whitespace-nowrap tabular-nums">
                {cedis(r.orderTotal)}
                {r.paidAmount != null && r.paidAmount !== r.orderTotal && (
                  <span className="block text-xs text-gray-500">paid {cedis(r.paidAmount)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
