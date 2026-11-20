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

// ─── Search boxes and filter dropdowns ─────────────────────────────────────────
// Coming back to a list only lands on the same rows if its search and filters
// are the same too, so their values are remembered per page alongside the scroll.

const CONTROLS_KEY = 'admin-place-controls-v1';

/** One remembered field: which control it was and what it held. */
export type SavedControl = { key: string; value: string };

/** Describes a control well enough to find it again after the page re-renders. */
export type ControlIdentity = {
  tag: 'input' | 'select';
  type: string;
  label: string;
  /** Position among controls with the same tag, type and label. */
  index: number;
};

export function controlKey(c: ControlIdentity): string {
  return `${c.tag}:${c.type}:${c.label}#${c.index}`;
}

/** Text-like inputs and dropdowns only; never passwords, files or checkboxes. */
export function isRememberedInputType(type: string): boolean {
  return ['text', 'search', 'date', 'month', 'number', ''].includes(type.toLowerCase());
}

export function parseSavedControls(raw: string | null): Record<string, SavedControl[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, SavedControl[]> = {};
    for (const [path, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      const controls = list.filter(
        (c): c is SavedControl =>
          !!c && typeof c === 'object' && typeof (c as SavedControl).key === 'string' && typeof (c as SavedControl).value === 'string',
      );
      out[normalizeAdminPath(path)] = controls.slice(0, 30).map((c) => ({ key: c.key, value: c.value.slice(0, 200) }));
    }
    return out;
  } catch {
    return {};
  }
}

export function readSavedControls(path: string): SavedControl[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseSavedControls(window.sessionStorage.getItem(CONTROLS_KEY))[normalizeAdminPath(path)] ?? [];
  } catch {
    return [];
  }
}

export function writeSavedControls(path: string, controls: SavedControl[]): void {
  if (typeof window === 'undefined') return;
  const key = normalizeAdminPath(path);
  if (!key || key === '/admin/login') return;
  try {
    const all = parseSavedControls(window.sessionStorage.getItem(CONTROLS_KEY));
    if (controls.length === 0) delete all[key];
    else all[key] = controls.slice(0, 30);
    const entries = Object.entries(all);
    const trimmed = entries.length > 40 ? Object.fromEntries(entries.slice(entries.length - 40)) : all;
    window.sessionStorage.setItem(CONTROLS_KEY, JSON.stringify(trimmed));
  } catch {
    // Convenience only.
  }
}
