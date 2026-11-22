'use client';

import { useEffect } from 'react';
import { reloadIfStaleBuild } from '@/lib/stale-build';

/**
 * Last-resort error page (replaces the root layout). Usually this is a tab
 * that was open across a site update: it reloads itself once to pick up the
 * new version, and only shows this page if that doesn't help.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
    // Usually the reload below happens before anyone reads this page.
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#16181D',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>
            This page didn’t load
          </h1>
          <p style={{ fontSize: 16, color: '#5B6170', margin: '0 0 24px' }}>
            The shop may have just been updated. Please reload. If it keeps happening, close the tab and open
            ronnyandme.com again.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  minHeight: 48,
                  padding: '0 24px',
                  borderRadius: 12,
                  border: 0,
                  background: '#D6336C',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{
                  minHeight: 48,
                  padding: '0 24px',
                  borderRadius: 12,
                  border: '2px solid #D6336C',
                  background: '#fff',
                  color: '#16181D',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
        </main>
      </body>
    </html>
  );
}
