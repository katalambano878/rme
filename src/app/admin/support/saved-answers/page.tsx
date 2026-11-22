'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import MarkdownMessage from '@/components/MarkdownMessage';

type SavedAnswer = {
  id: string;
  question: string;
  answer: string;
  product_ids: string[] | null;
  source: 'ai' | 'admin';
  pinned: boolean;
  hits: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

function shortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function SavedAnswersPage() {
  const [rows, setRows] = useState<SavedAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SavedAnswer | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term) params.set('search', term);
      const data = await adminFetch<{ data?: SavedAnswer[] }>(`/api/admin/chat-answers?${params}`);
      setRows(data.data || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load saved answers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  async function togglePin(row: SavedAnswer) {
    try {
      await adminFetch('/api/admin/chat-answers', { method: 'PATCH', body: JSON.stringify({ id: row.id, pinned: !row.pinned }) });
      load(search.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    }
  }

  async function remove(row: SavedAnswer) {
    if (!confirm(`Delete the saved answer for "${row.question}"? The assistant will write a fresh one next time.`)) return;
    try {
      await adminFetch(`/api/admin/chat-answers?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      load(search.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  const totalHits = rows.reduce((sum, r) => sum + (r.hits || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin/support" className="hover:text-rose-600">Support</Link>
            <i className="ri-arrow-right-s-line text-xs" />
            <span className="text-gray-900 font-medium">Saved answers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Saved answers</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            When a customer asks something another customer already asked, the assistant reuses the answer here
            instantly and for free. Edit any answer to say it your way — your answers are used first and never expire.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors self-start"
        >
          <i className="ri-add-line" /> Add your own answer
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Saved answers</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{rows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Times reused</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalHits}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500">Your own answers</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{rows.filter((r) => r.source === 'admin').length}</p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      <div className="relative">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search questions or answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl h-28 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <i className="ri-chat-check-line text-5xl mb-3 block text-gray-300" />
          <p className="text-sm font-medium text-gray-600">{search ? 'Nothing matches that search' : 'No saved answers yet'}</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Answers appear here as customers chat with the assistant. You can also add your own for questions you get often.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {row.pinned && (
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pinned</span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        row.source === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {row.source === 'admin' ? 'Your answer' : 'Written by assistant'}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">
                      Used {row.hits} {row.hits === 1 ? 'time' : 'times'} · last {shortDate(row.last_used_at ?? row.created_at)}
                      {row.expires_at && !row.pinned ? ` · refreshes ${shortDate(row.expires_at)}` : ''}
                      {row.product_ids?.length ? ` · ${row.product_ids.length} products` : ''}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">&ldquo;{row.question}&rdquo;</p>
                  <div className="mt-2 max-h-28 overflow-hidden text-gray-600 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                    <MarkdownMessage content={row.answer} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing(row)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <i className="ri-pencil-line" /> Edit
                  </button>
                  <button
                    onClick={() => togglePin(row)}
                    title={row.pinned ? 'Unpin' : 'Pin: always use this answer and never refresh it'}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                  >
                    <i className={row.pinned ? 'ri-pushpin-fill text-amber-500' : 'ri-pushpin-line'} />
                  </button>
                  <button
                    onClick={() => remove(row)}
                    title="Delete"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
                  >
                    <i className="ri-delete-bin-6-line" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(editing || adding) && (
        <AnswerModal
          row={editing}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => load(search.trim())}
        />
      )}
    </div>
  );
}

function AnswerModal({ row, onClose, onSaved }: { row: SavedAnswer | null; onClose: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState(row?.question || '');
  const [answer, setAnswer] = useState(row?.answer || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminFetch('/api/admin/chat-answers', {
        method: row ? 'PATCH' : 'POST',
        body: JSON.stringify(row ? { id: row.id, answer } : { question, answer, pinned: true }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">{row ? 'Edit answer' : 'Add your own answer'}</h2>
          <button onClick={onClose} aria-label="Close" className="size-9 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label htmlFor="sa-question" className="block text-xs font-medium text-gray-700 mb-1">Customer question</label>
            {row ? (
              <p id="sa-question" className="text-sm text-gray-900">&ldquo;{row.question}&rdquo;</p>
            ) : (
              <input
                id="sa-question"
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How much is delivery to Kumasi?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Similar wording from customers will get this answer too.</p>
          </div>
          <div>
            <label htmlFor="sa-answer" className="block text-xs font-medium text-gray-700 mb-1">Answer</label>
            <textarea
              id="sa-answer"
              required
              rows={10}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <p className="text-xs text-gray-400 mt-1">Use **two stars** around words to make them bold. Saving makes this your answer: it is used first and never expires.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save answer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
