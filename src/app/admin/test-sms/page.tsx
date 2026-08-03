'use client';

import { useState, useTransition, useEffect, useMemo, useCallback } from 'react';
import {
  testSmsAction,
  getSmsDebuggerStatus,
  dryRunSmsDebug,
} from './actions';
import { normalizeSmsRecipient } from '@/lib/sms-debug';

type StatusState =
  | { loading: true }
  | { loading: false; error: string }
  | {
      loading: false;
      error?: undefined;
      endpoint: string;
      smsVas: {
        configured: boolean;
        source: 'MOOLRE_SMS_API_KEY' | 'MOOLRE_API_KEY' | null;
        maskedPreview: string | null;
      };
      moolreEmbed: {
        MOOLRE_API_USER: boolean;
        MOOLRE_API_PUBKEY: boolean;
        MOOLRE_ACCOUNT_NUMBER: boolean;
        MOOLRE_MERCHANT_EMAIL: boolean;
      };
    };

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function SmsDebuggerPage() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<StatusState>({ loading: true });
  const [sendResult, setSendResult] = useState<unknown>(null);
  const [dryResult, setDryResult] = useState<unknown>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [phone, setPhone] = useState('024');
  const [message, setMessage] = useState('Test message from Standard Store Admin');

  const liveNorm = useMemo(() => {
    if (!phone.trim()) return null;
    return normalizeSmsRecipient(phone);
  }, [phone]);

  const loadStatus = useCallback(async () => {
    const res = await getSmsDebuggerStatus();
    if (!res.ok) {
      setStatus({ loading: false, error: res.error || 'Failed to load status' });
      return;
    }
    setStatus({
      loading: false,
      endpoint: res.endpoint,
      smsVas: res.smsVas,
      moolreEmbed: res.moolreEmbed,
    });
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleDryRun = () => {
    startTransition(async () => {
      const res = await dryRunSmsDebug(phone, message);
      setDryResult(res);
    });
  };

  const handleSend = () => {
    startTransition(async () => {
      const res = await testSmsAction(phone, message);
      setSendResult(res);
    });
  };

  const handleCopy = (key: string, json: unknown) => {
    copyToClipboard(JSON.stringify(json, null, 2));
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasOutput = sendResult != null || dryResult != null;

  return (
    <div className="min-h-full bg-[#F9FAFB] -m-4 -mt-0 px-4 py-8 sm:-mx-6 sm:px-8 lg:px-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Test SMS Integration
        </h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
          {/* Left: Send Test Request */}
          <section className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Send Test Request</h2>

            <div className="space-y-5">
              <div>
                <label htmlFor="sms-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  id="sms-phone"
                  type="text"
                  className="w-full rounded-lg border border-gray-200 bg-[#F3F4F6] px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-400/25"
                  placeholder="024"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Try local format (024…) to test auto-formatting (+23324…)
                </p>
              </div>

              {liveNorm && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    liveNorm.looksValidGh
                      ? 'border-rose-200 bg-pink-50/90 text-rose-800'
                      : 'border-amber-200 bg-amber-50/80 text-amber-900'
                  }`}
                >
                  <span className="font-medium">Normalized: </span>
                  <span className="font-mono">{liveNorm.recipient}</span>
                </div>
              )}

              <div>
                <label htmlFor="sms-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Message
                </label>
                <textarea
                  id="sms-message"
                  className="w-full min-h-[120px] resize-y rounded-lg border border-gray-200 bg-[#F3F4F6] px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-400/25"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                />
                <p className="mt-1 text-xs text-gray-400">{message.length} / 1000</p>
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={isPending}
                className="w-full rounded-lg bg-rose-500 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Sending…' : 'Send SMS'}
              </button>

              <button
                type="button"
                onClick={handleDryRun}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {isPending ? 'Working…' : 'Dry run (no SMS)'}
              </button>
            </div>
          </section>

          {/* Right: Response & Debug Log */}
          <section className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm flex flex-col min-h-[min(420px,60vh)]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Response &amp; Debug Log</h2>
              {hasOutput && (
                <button
                  type="button"
                  onClick={() => handleCopy('all', { dryRun: dryResult, send: sendResult })}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline"
                >
                  {copied === 'all' ? 'Copied' : 'Copy all'}
                </button>
              )}
            </div>

            <div className="flex-1 rounded-lg border-2 border-dashed border-gray-200 bg-[#FAFBFC] min-h-[280px] flex flex-col overflow-hidden">
              {!hasOutput ? (
                <div className="flex flex-1 items-center justify-center px-4 py-12">
                  <p className="text-sm text-gray-400">Waiting for response…</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4 text-left space-y-6">
                  {dryResult != null && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dry run</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('dry', dryResult)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          {copied === 'dry' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words bg-white/80 rounded-md p-3 border border-gray-100">
                        {JSON.stringify(dryResult, null, 2)}
                      </pre>
                    </div>
                  )}
                  {sendResult != null && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Send result</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('send', sendResult)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          {copied === 'send' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words bg-white/80 rounded-md p-3 border border-gray-100">
                        {JSON.stringify(sendResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Environment (compact, below) */}
        <details className="rounded-xl border border-gray-200/80 bg-white shadow-sm group">
          <summary className="cursor-pointer list-none px-5 py-3.5 font-semibold text-gray-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <i className="ri-settings-3-line text-gray-500 text-lg" aria-hidden />
              Environment &amp; API
            </span>
            <i className="ri-arrow-down-s-line text-gray-400 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-4 text-sm">
            {status.loading && <p className="text-gray-500 pt-4">Loading configuration…</p>}
            {!status.loading && 'error' in status && status.error && (
              <p className="text-red-600 pt-4">{status.error}</p>
            )}
            {!status.loading && !('error' in status && status.error) && status.loading === false && 'smsVas' in status && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">SMS VAS key</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          status.smsVas.configured ? 'bg-pink-100 text-rose-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {status.smsVas.configured ? 'Configured' : 'Missing'}
                      </span>
                      {status.smsVas.source && (
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{status.smsVas.source}</code>
                      )}
                      {status.smsVas.maskedPreview && (
                        <span className="font-mono text-sm text-gray-700">{status.smsVas.maskedPreview}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Endpoint</p>
                    <code className="text-xs break-all block bg-[#F3F4F6] border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
                      {status.endpoint}
                    </code>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Refresh status
                </button>
              </>
            )}
          </div>
        </details>

        {liveNorm && liveNorm.steps.length > 0 && (
          <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Normalization steps</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              {liveNorm.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
