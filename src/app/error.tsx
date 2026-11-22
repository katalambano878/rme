'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reloadIfStaleBuild } from '@/lib/stale-build';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
    // A tab open across a site update: reload once to pick up the new version.
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-white">
      <div className="w-16 h-16 rounded-full bg-blush flex items-center justify-center mb-6">
        <i className="ri-error-warning-line text-3xl text-raspberry" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Something went wrong</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Please try again. If you keep seeing this after a site update, hard-refresh or reopen the app.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-8 py-3 rounded-full bg-brand text-white font-semibold hover:bg-brand-deep transition-colors"
        >
          Try again
        </button>
        <Link
          href="/shop"
          className="px-8 py-3 rounded-full border-2 border-brand text-ink font-semibold hover:bg-blush transition-colors"
        >
          Go to Shop
        </Link>
      </div>
    </div>
  );
}
