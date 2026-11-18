/**
 * Remembers how far down an admin page the staff member had scrolled, so opening
 * a detail (an order, a product, a customer) and coming back continues at that
 * spot instead of the top of the list.
 */

const STORAGE_KEY = 'admin-place-v1';

export function normalizeAdminPath(path: string): string {
  if (!path) return '';
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? '';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery;
}

/** True when `to` is the list (or any ancestor) she just stepped out of. */
export function isReturnFromChild(from: string, to: string): boolean {
  const child = normalizeAdminPath(from);
  const parent = normalizeAdminPath(to);
  if (!child || !parent || child === parent) return false;
  return child.startsWith(`${parent}/`);
}

export function parseAdminPlaces(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const places: Record<string, number> = {};
    for (const [path, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        places[normalizeAdminPath(path)] = value;
      }
    }
    return places;
  } catch {
    return {};
  }
}

export function readAdminPlace(path: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseAdminPlaces(window.sessionStorage.getItem(STORAGE_KEY))[normalizeAdminPath(path)] ?? 0;
  } catch {
    return 0;
  }
}

export function writeAdminPlace(path: string, scrollY: number): void {
  if (typeof window === 'undefined') return;
  const key = normalizeAdminPath(path);
  if (!key || key === '/admin/login') return;
  const y = Math.max(0, Math.round(scrollY));
  try {
    const places = parseAdminPlaces(window.sessionStorage.getItem(STORAGE_KEY));
    if (places[key] === y) return;
    places[key] = y;
    const entries = Object.entries(places);
    const trimmed = entries.length > 40 ? Object.fromEntries(entries.slice(entries.length - 40)) : places;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage can be unavailable; keeping her place is a convenience.
  }
}
