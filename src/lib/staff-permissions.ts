import { canManageStaffRoles } from '@/lib/admin-role-access';

/** Keys stored in profiles.permissions (JSON). */
export const STAFF_PERMISSION_AREAS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'pos', label: 'POS' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
  { key: 'categories', label: 'Categories' },
  { key: 'customers', label: 'Customers' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'blog', label: 'Blog' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'support', label: 'Support Hub' },
  { key: 'customer_insights', label: 'Customer Insights' },
  { key: 'modules', label: 'Modules' },
  { key: 'sms_debug', label: 'SMS Debugger' },
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_AREAS)[number]['key'];

export function defaultStaffPermissions(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  for (const { key } of STAFF_PERMISSION_AREAS) o[key] = true;
  return o;
}

/** Map URL to permission key; null = no specific gate (allow). */
export function pathToPermissionKey(pathname: string): string | null {
  if (pathname === '/admin' || pathname === '/admin/') return 'dashboard';
  const rules: [string, string][] = [
    ['/admin/orders', 'orders'],
    ['/admin/pos', 'pos'],
    ['/admin/products', 'products'],
    ['/admin/sales', 'sales'],
    ['/admin/categories', 'categories'],
    ['/admin/customers', 'customers'],
    ['/admin/reviews', 'reviews'],
    ['/admin/inventory', 'inventory'],
    ['/admin/analytics', 'analytics'],
    ['/admin/coupons', 'coupons'],
    ['/admin/customer-insights', 'customer_insights'],
    ['/admin/notifications', 'notifications'],
    ['/admin/support', 'support'],
    ['/admin/test-sms', 'sms_debug'],
    ['/admin/blog', 'blog'],
    ['/admin/modules', 'modules'],
  ];
  for (const [prefix, key] of rules) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

/**
 * Staff management is admin-only (not driven by JSON flags).
 * Other areas use profiles.permissions when role is `staff`.
 */
export function staffCanAccessPath(
  role: string | null | undefined,
  permissions: Record<string, unknown> | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  if (pathname === '/admin/login') return true;
  if (role === 'admin' || role === 'superadmin') return true;

  if (pathname.startsWith('/admin/staff')) {
    return canManageStaffRoles(role);
  }

  if (role !== 'staff') return true;

  const key = pathToPermissionKey(pathname);
  if (!key) return true;

  if (!permissions || Object.keys(permissions).length === 0) return true;

  return permissions[key] === true;
}

/** Full set of flags; missing keys become false. */
export function sanitizeStaffPermissions(input: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const { key } of STAFF_PERMISSION_AREAS) {
    out[key] = !!(input && typeof input[key] === 'boolean' && input[key]);
  }
  return out;
}

/** Order matches admin sidebar (first match wins). */
export const ADMIN_NAV_ORDER: { path: string; permissionKey: StaffPermissionKey }[] = [
  { path: '/admin', permissionKey: 'dashboard' },
  { path: '/admin/orders', permissionKey: 'orders' },
  { path: '/admin/pos', permissionKey: 'pos' },
  { path: '/admin/products', permissionKey: 'products' },
  { path: '/admin/sales', permissionKey: 'sales' },
  { path: '/admin/categories', permissionKey: 'categories' },
  { path: '/admin/customers', permissionKey: 'customers' },
  { path: '/admin/reviews', permissionKey: 'reviews' },
  { path: '/admin/inventory', permissionKey: 'inventory' },
  { path: '/admin/analytics', permissionKey: 'analytics' },
  { path: '/admin/coupons', permissionKey: 'coupons' },
  { path: '/admin/customer-insights', permissionKey: 'customer_insights' },
  { path: '/admin/notifications', permissionKey: 'notifications' },
  { path: '/admin/support', permissionKey: 'support' },
  { path: '/admin/test-sms', permissionKey: 'sms_debug' },
  { path: '/admin/blog', permissionKey: 'blog' },
  { path: '/admin/modules', permissionKey: 'modules' },
];

/**
 * When the current URL is not allowed, navigate here (first allowed section).
 * Returns null if no section is enabled (avoid redirect loops).
 */
export function firstAccessibleAdminPath(
  role: string | null | undefined,
  permissions: Record<string, unknown> | null | undefined,
): string | null {
  if (!role || role === 'admin' || role === 'superadmin') return '/admin';
  if (role !== 'staff') return '/admin';
  if (!permissions || Object.keys(permissions).length === 0) return '/admin';
  for (const { path, permissionKey } of ADMIN_NAV_ORDER) {
    if (permissions[permissionKey] === true) return path;
  }
  return null;
}
