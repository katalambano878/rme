'use client';

import Link from 'next/link';
import BlogPostForm from '@/components/admin/BlogPostForm';

export default function AdminNewBlogPostPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Blog Post</h1>
          <p className="mt-1 text-gray-600">Write your post and publish when ready.</p>
        </div>
        <Link
          href="/admin/blog"
          className="rounded-lg border-2 border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:border-gray-400"
        >
          Back to Blog
        </Link>
      </div>

      <BlogPostForm mode="create" />
    </div>
  );
}
