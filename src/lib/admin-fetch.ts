'use client';

/** Calls an admin API route with the signed-in cookie and returns parsed JSON or throws. */
export async function adminFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof json?.error === 'string' ? json.error : json?.error?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return json as T;
}

export function cedis(n: number | null | undefined): string {
  const value = Number(n) || 0;
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
