'use client';

/* eslint-disable react-hooks/exhaustive-deps */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type BlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  image: string | null;
  excerpt: string;
  status: 'Published' | 'Draft';
  publishDate: string;
};

const PLACEHOLDER_IMG = null;

export default function AdminBlogPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, category, cover_image_url, published, published_at, updated_at, created_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const mapped: BlogPostListItem[] = (data ?? []).map((p: any) => {
        const published = Boolean(p.published);
        const dateRaw = p.published_at || p.updated_at || p.created_at;
        return {
          id: p.id,
          title: p.title ?? 'Untitled',
          slug: p.slug ?? '',
          category: (p.category as string)?.trim() || 'Uncategorized',
          image: (p.cover_image_url as string)?.trim() || PLACEHOLDER_IMG,
          excerpt: (p.excerpt as string)?.trim() || '—',
          status: published ? 'Published' : 'Draft',
          publishDate: dateRaw ? new Date(dateRaw).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—',
        };
      });
      setPosts(mapped);
    } catch (e) {
      console.error(e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    Published: 'bg-rose-100 text-rose-800',
    Draft: 'bg-gray-100 text-gray-700',
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === posts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(posts.map((p) => p.id));
    }
  };

  const handleSelectPost = (postId: string) => {
    if (selectedPosts.includes(postId)) {
      setSelectedPosts(selectedPosts.filter((id) => id !== postId));
    } else {
      setSelectedPosts([...selectedPosts, postId]);
    }
  };

  const publishedCount = posts.filter((p) => p.status === 'Published').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-600 mt-1">Create and manage your blog content</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>
          New Post
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Posts</p>
          <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Published</p>
          <p className="text-2xl font-bold text-rose-700">{publishedCount}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Drafts</p>
          <p className="text-2xl font-bold text-gray-900">{posts.length - publishedCount}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Selected</p>
          <p className="text-2xl font-bold text-gray-900">{selectedPosts.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-gray-600">Posts are loaded from Supabase. Edit opens the full editor.</p>
            <div className="flex border-2 border-gray-300 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`w-10 h-10 flex items-center justify-center transition-colors ${
                  viewMode === 'grid' ? 'bg-rose-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className="ri-grid-line text-xl"></i>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`w-10 h-10 flex items-center justify-center border-l-2 border-gray-300 transition-colors ${
                  viewMode === 'list' ? 'bg-rose-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className="ri-list-check text-xl"></i>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-loader-4-line animate-spin text-3xl mb-2 inline-block"></i>
            <p>Loading posts…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No blog posts yet</p>
            <Link href="/admin/blog/new" className="text-rose-700 font-semibold hover:underline">
              Create your first post
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <div key={post.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedPosts.includes(post.id)}
                    onChange={() => handleSelectPost(post.id)}
                    className="absolute top-3 left-3 w-5 h-5 text-rose-700 border-gray-300 rounded focus:ring-rose-400 cursor-pointer z-10"
                  />
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {post.image
                      ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={post.image} alt="" className="w-full h-full object-cover" /></>
                      : <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="ri-image-line text-3xl"></i></div>
                    }
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-rose-700 truncate max-w-[50%]">{post.category}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${statusColors[post.status]}`}>
                      {post.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200">
                    <span className="whitespace-nowrap">{post.publishDate}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-sm font-medium text-center transition-colors whitespace-nowrap"
                    >
                      Edit Post
                    </Link>
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 text-gray-700 hover:border-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="View on site"
                    >
                      <i className="ri-eye-line"></i>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={posts.length > 0 && selectedPosts.length === posts.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-rose-700 border-gray-300 rounded focus:ring-rose-400 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Post</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selectedPosts.includes(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        className="w-4 h-4 text-rose-700 border-gray-300 rounded focus:ring-rose-400 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-20 h-14 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                          {post.image
                            ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={post.image} alt="" className="w-full h-full object-cover" /></>
                            : <i className="ri-image-line text-gray-400 text-xl"></i>
                          }
                        </div>
                        <div className="min-w-0">
                          <Link href={`/admin/blog/${post.id}`} className="font-semibold text-gray-900 hover:text-rose-700 line-clamp-2">
                            {post.title}
                          </Link>
                          <p className="text-sm text-gray-500 mt-1">{post.publishDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{post.category}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[post.status]}`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{post.publishDate}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-rose-700 hover:bg-pink-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </Link>
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-rose-700 hover:bg-pink-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <i className="ri-eye-line text-lg"></i>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <p className="text-gray-600">Showing {posts.length} post{posts.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}
