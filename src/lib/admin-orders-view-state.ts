/**
 * Remembers where the admin was on the Orders list (filters + last opened order)
 * for the current browser tab, so opening an order to pack it and coming back
 * returns her to the same spot instead of the top of a reset list.
 */

export type OrdersViewTab = 'confirmed' | 'abandoned';

export type OrdersViewState = {
  tab: OrdersViewTab;
  statusFilter: string;
  searchQuery: string;
  productFilter: string;
  sortBy: string;
  lastOpenedOrderId: string | null;
  scrollY: number;
};

const STORAGE_KEY = 'admin-orders-view-v1';

export const DEFAULT_ORDERS_VIEW: OrdersViewState = {
  tab: 'confirmed',
  statusFilter: 'all',
  searchQuery: '',
  productFilter: 'all',
  sortBy: 'date',
  lastOpenedOrderId: null,
  scrollY: 0,
};

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseOrdersViewState(raw: string | null): OrdersViewState {
  if (!raw) return DEFAULT_ORDERS_VIEW;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      tab: parsed.tab === 'abandoned' ? 'abandoned' : 'confirmed',
      statusFilter: asString(parsed.statusFilter, DEFAULT_ORDERS_VIEW.statusFilter),
      searchQuery: asString(parsed.searchQuery, DEFAULT_ORDERS_VIEW.searchQuery),
      productFilter: asString(parsed.productFilter, DEFAULT_ORDERS_VIEW.productFilter),
      sortBy: asString(parsed.sortBy, DEFAULT_ORDERS_VIEW.sortBy),
      lastOpenedOrderId: typeof parsed.lastOpenedOrderId === 'string' ? parsed.lastOpenedOrderId : null,
      scrollY: typeof parsed.scrollY === 'number' && Number.isFinite(parsed.scrollY) ? parsed.scrollY : 0,
    };
  } catch {
    return DEFAULT_ORDERS_VIEW;
  }
}

export function readOrdersViewState(): OrdersViewState {
  if (typeof window === 'undefined') return DEFAULT_ORDERS_VIEW;
  try {
    return parseOrdersViewState(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_ORDERS_VIEW;
  }
}

export function writeOrdersViewState(patch: Partial<OrdersViewState>): void {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...readOrdersViewState(), ...patch };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode / quota); position memory is best-effort.
  }
}
