'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BlogPostForm from '@/components/admin/BlogPostForm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AdminEditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!UUID_RE.test(id)) {
        setError('invalid-id');
        setLoading(false);
        return;
      }
      const data = await api<Record<string, unknown>>(`/api/admin/blog/${id}`);
      if (cancelled) return;
      if (!data) {
        setError('not-found');
      } else {
        setRow(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Blog Post</h1>
          <p className="mt-1 text-gray-600 font-mono text-sm">ID: {id}</p>
        </div>
        <Link
          href="/admin/blog"
          className="rounded-lg border-2 border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:border-gray-400"
        >
          Back to Blog
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-600">
          <i className="ri-loader-4-line animate-spin text-3xl inline-block mb-2 text-rose-primary"></i>
          <p>Loading post…</p>
        </div>
      ) : error === 'invalid-id' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="font-semibold">This link uses an old demo ID.</p>
          <p className="mt-2 text-sm">
            Open <Link href="/admin/blog" className="font-semibold text-navy underline">Blog Posts</Link>, then use
            “Edit” on a real post (posts are stored in Supabase with a UUID id).
          </p>
        </div>
      ) : error === 'not-found' ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-gray-800">
          <p className="font-semibold">Post not found</p>
          <p className="mt-2 text-sm">It may have been deleted, or the ID is wrong.</p>
          <Link href="/admin/blog" className="mt-4 inline-block text-navy font-semibold hover:underline">
            ← Back to Blog
          </Link>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 text-sm">{error}</div>
      ) : row ? (
        <BlogPostForm mode="edit" postId={id} initialData={row as any} />
      ) : null}
    </div>
  );
}
