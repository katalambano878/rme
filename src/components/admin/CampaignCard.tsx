'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { Campaign, CampaignState } from '@/lib/effective-price';

// Ghana is GMT all year, so the shop's clock is UTC.
const SHOP_TZ = 'Africa/Accra';

/** ISO → value for <input type="datetime-local"> in the shop's time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** <input type="datetime-local"> value, read as shop time (GMT) → ISO. */
function fromLocalInput(value: string): string {
  return value ? new Date(`${value}:00Z`).toISOString() : '';
}

function prettyTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: SHOP_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

const PRESETS = [
  { label: 'Friday only', start: '2026-11-27T00:00', end: '2026-11-28T00:00' },
  { label: 'Fri – Sun', start: '2026-11-27T00:00', end: '2026-11-30T00:00' },
  { label: 'Fri – Cyber Monday', start: '2026-11-27T00:00', end: '2026-12-01T00:00' },
];

const STATE_UI: Record<CampaignState, { label: string; className: string }> = {
  live: { label: 'Live now', className: 'bg-green-100 text-green-800' },
  upcoming: { label: 'Scheduled', className: 'bg-amber-100 text-amber-800' },
  ended: { label: 'Ended', className: 'bg-gray-100 text-gray-600' },
  off: { label: 'Paused', className: 'bg-gray-100 text-gray-600' },
};

export default function CampaignCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<Campaign | null>(null);
  const [state, setState] = useState<CampaignState>('off');

  const [name, setName] = useState('Black Friday');
  const [percent, setPercent] = useState('20');
  const [start, setStart] = useState(PRESETS[1].start);
  const [end, setEnd] = useState(PRESETS[1].end);
  const [message, setMessage] = useState('');

  const apply = useCallback((c: Campaign | null, s: CampaignState) => {
    setSaved(c);
    setState(s);
    if (c) {
      setName(c.name);
      setPercent(String(c.discountPercent));
      setStart(toLocalInput(c.startsAt));
      setEnd(toLocalInput(c.endsAt));
      setMessage(c.message);
    }
  }, []);

  useEffect(() => {
    adminFetch<{ campaign: Campaign | null; state: CampaignState }>('/api/admin/campaign')
      .then((d) => apply(d.campaign, d.state))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the campaign'))
      .finally(() => setLoading(false));
  }, [apply]);

  async function save(enabled: boolean) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const d = await adminFetch<{ campaign: Campaign | null; state: CampaignState }>('/api/admin/campaign', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          name,
          discountPercent: Number(percent || 0),
          startsAt: fromLocalInput(start),
          endsAt: fromLocalInput(end),
          message,
        }),
      });
      apply(d.campaign, d.state);
      setNotice(
        !enabled
          ? 'Paused. Customers see your normal prices.'
          : d.state === 'live'
            ? `${name} is live. Customers see the sale prices now.`
            : `Saved. ${name} starts on its own at ${prettyTime(d.campaign!.startsAt)}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${saved?.name || 'this campaign'}? Prices go back to normal straight away.`)) return;
    setSaving(true);
    setError('');
    try {
      await adminFetch('/api/admin/campaign', { method: 'PUT', body: JSON.stringify({ remove: true }) });
      setSaved(null);
      setState('off');
      setNotice('Campaign removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove');
    } finally {
      setSaving(false);
    }
  }

  const pct = Number(percent || 0);
  const example = Math.round(100 * (1 - pct / 100));

  return (
    <section className="rounded-2xl border-2 border-gray-900 bg-white p-5 sm:p-6 max-w-3xl" aria-labelledby="campaign-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="campaign-title" className="text-xl font-bold text-gray-900">
            <i className="ri-price-tag-3-line mr-1.5 text-rose-600" />
            Black Friday &amp; timed sales
          </h2>
          <p className="mt-1 text-sm text-gray-600 max-w-xl">
            Set it once: the sale switches on and off by itself. While it runs, every customer sees a countdown bar, a
            banner on the home and shop pages, the deals page and the chat assistant all telling them about it.
          </p>
        </div>
        {saved && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATE_UI[state].className}`}>
            {STATE_UI[state].label}
          </span>
        )}
      </div>

      {saved && state !== 'off' && (
        <p className="mt-3 text-sm text-gray-700">
          <strong>{saved.name}</strong>: {prettyTime(saved.startsAt)} → {prettyTime(saved.endsAt)} (Ghana time)
        </p>
      )}

      {loading ? (
        <div className="mt-5 h-40 rounded-xl bg-gray-50 animate-pulse" />
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cmp-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="cmp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-[16px] sm:text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="cmp-pct" className="block text-sm font-medium text-gray-700 mb-1">% off everything</label>
              <div className="relative">
                <input
                  id="cmp-pct"
                  type="number"
                  min={0}
                  max={90}
                  step={1}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 py-3 pl-4 pr-10 text-[16px] sm:text-sm focus:border-rose-500 focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
              </div>
            </div>
          </div>

          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {pct > 0 ? (
              <>
                Every product is <strong>{pct}% off</strong> (GH₵100 → GH₵{example}). Products where you set your own
                sale price get <strong>whichever is cheaper</strong>, so no one gets a smaller deal.
              </>
            ) : (
              <>At 0%, only the products where you set your own sale price are reduced.</>
            )}
          </p>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">When (Ghana time)</legend>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = start === p.start && end === p.end;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setStart(p.start);
                      setEnd(p.end);
                    }}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium ${
                      active ? 'border-rose-600 bg-rose-600 text-white' : 'border-gray-300 text-gray-700 hover:border-rose-400'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cmp-start" className="block text-xs font-medium text-gray-500 mb-1">Starts</label>
                <input
                  id="cmp-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-[16px] sm:text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="cmp-end" className="block text-xs font-medium text-gray-500 mb-1">Ends</label>
                <input
                  id="cmp-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-[16px] sm:text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Midnight to midnight: an end of Sat 00:00 means it runs all of Friday.</p>
          </fieldset>

          <div>
            <label htmlFor="cmp-msg" className="block text-sm font-medium text-gray-700 mb-1">
              Notice bar text <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="cmp-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={160}
              placeholder={pct > 0 ? `${name}: ${pct}% off everything` : `${name}: big savings across the store`}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-[16px] sm:text-sm focus:border-rose-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">The countdown is added automatically.</p>
          </div>

          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          {notice && <p role="status" className="text-sm font-medium text-green-700">{notice}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving && <i className="ri-loader-4-line animate-spin" />}
              {saved ? 'Save changes' : `Schedule ${name || 'sale'}`}
            </button>
            {saved && saved.enabled && state !== 'ended' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => save(false)}
                className="min-h-12 rounded-xl border-2 border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Pause
              </button>
            )}
            {saved && (
              <button
                type="button"
                disabled={saving}
                onClick={remove}
                className="min-h-12 rounded-xl px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
