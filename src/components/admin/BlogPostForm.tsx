'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function slugifyTitle(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export type BlogPostRow = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  cover_image_url: string | null;
  category: string | null;
  published: boolean;
  published_at: string | null;
  read_time_minutes: number | null;
};

type BlogPostFormProps = {
  mode: 'create' | 'edit';
  postId?: string;
  initialData?: Partial<BlogPostRow> | null;
};

export default function BlogPostForm({ mode, postId, initialData }: BlogPostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(() => Boolean(mode === 'edit' && String(initialData?.slug ?? '').trim()));
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '');
  const [body, setBody] = useState(initialData?.body ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.cover_image_url ?? '');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [published, setPublished] = useState(initialData?.published ?? false);
  const [readTime, setReadTime] = useState(
    initialData?.read_time_minutes != null ? String(initialData.read_time_minutes) : '',
  );

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title ?? '');
      setSlug(initialData.slug ?? '');
      setSlugTouched(Boolean(String(initialData.slug ?? '').trim()));
      setExcerpt(initialData.excerpt ?? '');
      setBody(initialData.body ?? '');
      setCoverImageUrl(initialData.cover_image_url ?? '');
      setCategory(initialData.category ?? '');
      setPublished(initialData.published ?? false);
      setReadTime(initialData.read_time_minutes != null ? String(initialData.read_time_minutes) : '');
    }
  }, [initialData]);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugifyTitle(title));
  }, [title, slugTouched]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'blog');
      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: formData, credentials: 'include' });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || 'Upload failed');
      setCoverImageUrl(uploadJson.url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const estimateReadTime = useCallback(() => {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) return;
    setReadTime(String(Math.max(1, Math.round(words / 200))));
  }, [body]);

  const handleSubmit = async () => {
    const t = title.trim();
    const s = slug.trim() || slugifyTitle(t);
    if (!t) {
      alert('Title is required');
      return;
    }
    let published_at: string | null = null;
    if (published) {
      if (mode === 'edit' && initialData?.published_at) {
        published_at = initialData.published_at;
      } else {
        published_at = new Date().toISOString();
      }
    }

    const payload = {
      title: t,
      slug: s,
      excerpt: excerpt.trim() || null,
      body: body.trim() || null,
      cover_image_url: coverImageUrl.trim() || null,
      category: category.trim() || null,
      published,
      published_at,
      read_time_minutes: readTime.trim() ? parseInt(readTime, 10) || null : null,
      updated_at: new Date().toISOString(),
    };

    try {
      setLoading(true);
      if (mode === 'create') {
        await api('/api/admin/blog', { method: 'POST', json: payload });
        alert('Post created');
      } else if (postId) {
        await api(`/api/admin/blog/${postId}`, { method: 'PATCH', json: payload });
        alert('Post saved');
      }
      router.push('/admin/blog');
      router.refresh();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (/duplicate key|slug/i.test(m)) {
        alert('That slug is already used. Change the slug and try again.');
      } else {
        alert(m || 'Failed to save');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
            placeholder="Post title"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-900">URL slug *</label>
            <button
              type="button"
              onClick={() => {
                setSlug(slugifyTitle(title));
                setSlugTouched(false);
              }}
              className="text-xs font-semibold text-navy hover:text-navy"
            >
              Sync from title
            </button>
          </div>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary font-mono text-sm"
            placeholder="url-friendly-slug"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary resize-none"
            placeholder="Short summary for listings"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Content</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary font-mono text-sm"
            placeholder="Full post body (plain text or HTML)"
          />
          <p className="text-xs text-gray-500 mt-1">
            <button type="button" onClick={estimateReadTime} className="text-navy font-medium hover:underline">
              Estimate read time
            </button>{' '}
            from word count (~200 wpm).
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
            placeholder="e.g. Interior Design"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Cover image</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary text-sm"
              placeholder="https://…"
            />
            <label className="inline-flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-rose-primary cursor-pointer text-sm font-medium text-gray-700 whitespace-nowrap">
              {uploading ? 'Uploading…' : 'Upload file'}
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploading} />
            </label>
          </div>
          {coverImageUrl ? (
            <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 max-w-md aspect-video bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Read time (minutes)</label>
            <input
              type="number"
              min={1}
              value={readTime}
              onChange={(e) => setReadTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
              placeholder="Auto or manual"
            />
          </div>
          <div className="flex items-center gap-3 pt-8">
            <input
              type="checkbox"
              id="blog-published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-5 h-5 text-navy border-gray-300 rounded focus:ring-navy"
            />
            <label htmlFor="blog-published" className="text-gray-900 font-medium">
              Published (visible on storefront when published)
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-3 bg-navy hover:bg-navy disabled:opacity-60 text-white rounded-lg font-semibold transition-colors"
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Create post' : 'Save changes'}
        </button>
        <Link
          href="/admin/blog"
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
