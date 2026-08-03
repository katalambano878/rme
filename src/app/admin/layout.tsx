'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';
import { canAccessAdminPanel, canManageStaffRoles } from '@/lib/admin-role-access';
import { firstAccessibleAdminPath, staffCanAccessPath } from '@/lib/staff-permissions';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, unknown> | null>(null);

  // Module Filtering State
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  useEffect(() => {
    async function checkAuth() {
      if (pathname === '/admin/login') {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api<{
          user: { id: string; email: string; role: string; full_name?: string | null };
          profile: { role?: string; permissions?: Record<string, unknown> | null };
        }>('/api/auth/me');

        const role = data.profile?.role || data.user.role;
        if (!canAccessAdminPanel(role)) {
          await api('/api/auth/logout', { method: 'POST' });
          router.push('/admin/login?error=unauthorized');
          return;
        }

        setUser(data.user);
        setUserRole(role);
        setUserPermissions(data.profile?.permissions ?? null);
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch {
        router.push('/admin/login');
      }
    }

    checkAuth();
  }, [pathname, router]);

  /** Block direct URL access to admin sections staff accounts are not allowed to use. */
  useEffect(() => {
    if (pathname === '/admin/login' || !isAuthenticated || !userRole) return;
    if (!staffCanAccessPath(userRole, userPermissions, pathname)) {
      const next = firstAccessibleAdminPath(userRole, userPermissions);
      if (next && next !== pathname) router.replace(next);
    }
  }, [pathname, userRole, userPermissions, isAuthenticated, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Modules table may not exist on plain Postgres — keep core links visible.
  useEffect(() => {
    setEnabledModules(['customer-insights', 'notifications', 'blog']);
  }, []);

  // Screen size check for initial state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // Only set to false if it's currently true? 
        // Actually, let's just default to open on desktop, closed on mobile on mount only
      }
    };

    // Set initial state based on width
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }

    // Optional: Auto-close on resize to mobile? For now, leave as is.
  }, []);

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    router.push('/admin/login');
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading {BRAND_NAME} Admin...</div>;
  }

  const menuItems: {
    title: string;
    icon: string;
    path: string;
    exact?: boolean;
    badge?: string;
    moduleId?: string;
    permissionKey?: string;
    requiresAdmin?: boolean;
  }[] = [
    {
      title: 'Dashboard',
      icon: 'ri-dashboard-line',
      path: '/admin',
      exact: true,
      permissionKey: 'dashboard',
    },
    {
      title: 'Orders',
      icon: 'ri-shopping-bag-line',
      path: '/admin/orders',
      badge: '',
      permissionKey: 'orders',
    },
    {
      title: 'POS System',
      icon: 'ri-store-3-line',
      path: '/admin/pos',
      permissionKey: 'pos',
    },
    {
      title: 'Products',
      icon: 'ri-box-3-line',
      path: '/admin/products',
      permissionKey: 'products',
    },
    {
      title: 'Sales',
      icon: 'ri-price-tag-3-line',
      path: '/admin/sales',
      permissionKey: 'sales',
    },
    {
      title: 'Categories',
      icon: 'ri-folder-line',
      path: '/admin/categories',
      permissionKey: 'categories',
    },
    {
      title: 'Customers',
      icon: 'ri-group-line',
      path: '/admin/customers',
      permissionKey: 'customers',
    },
    {
      title: 'Staff',
      icon: 'ri-team-line',
      path: '/admin/staff',
      requiresAdmin: true,
    },
    {
      title: 'Reviews',
      icon: 'ri-chat-smile-2-line',
      path: '/admin/reviews',
      permissionKey: 'reviews',
    },
    {
      title: 'Inventory',
      icon: 'ri-stack-line',
      path: '/admin/inventory',
      permissionKey: 'inventory',
    },
    {
      title: 'Analytics',
      icon: 'ri-bar-chart-line',
      path: '/admin/analytics',
      permissionKey: 'analytics',
    },
    {
      title: 'Coupons',
      icon: 'ri-coupon-2-line',
      path: '/admin/coupons',
      permissionKey: 'coupons',
    },
    {
      title: 'Customer Insights',
      icon: 'ri-user-search-line',
      path: '/admin/customer-insights',
      moduleId: 'customer-insights',
      permissionKey: 'customer_insights',
    },
    {
      title: 'Notifications',
      icon: 'ri-notification-3-line',
      path: '/admin/notifications',
      moduleId: 'notifications',
      permissionKey: 'notifications',
    },
    {
      title: 'Support Hub',
      icon: 'ri-customer-service-2-line',
      path: '/admin/support',
      permissionKey: 'support',
    },
    {
      title: 'SMS Debugger',
      icon: 'ri-message-2-line',
      path: '/admin/test-sms',
      permissionKey: 'sms_debug',
    },

    {
      title: 'Blog',
      icon: 'ri-article-line',
      path: '/admin/blog',
      moduleId: 'blog',
      permissionKey: 'blog',
    },
    {
      title: 'Modules',
      icon: 'ri-puzzle-line',
      path: '/admin/modules',
      permissionKey: 'modules',
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.moduleId && !enabledModules.includes(item.moduleId)) return false;
    if (item.requiresAdmin && !canManageStaffRoles(userRole)) return false;
    if (userRole === 'staff' && item.permissionKey) {
      if (!userPermissions || Object.keys(userPermissions).length === 0) return true;
      if (userPermissions[item.permissionKey] !== true) return false;
    }
    return true;
  });

  // Special layout for Login Page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 admin-app">

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden glass-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Transform / Desktop: Width transition */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300
          w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isSidebarOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}
          lg:translate-x-0
        `}
      >
        <div className="h-full px-3 py-5 overflow-y-auto text-[13px] leading-snug">
          <Link href="/admin" className="flex items-center gap-2 mb-6 px-2 cursor-pointer">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_LOGO_ALT} width={56} height={18} className="h-5 w-auto object-contain" style={{ width: 'auto', height: 'auto' }} />
            <span className="text-[10px] font-semibold text-gray-500 tracking-wide truncate">{BRAND_NAME} Admin</span>
          </Link>

          <nav className="space-y-0.5">
            {visibleMenuItems.map((item) => {
              const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)} // Close on mobile click
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${isActive
                    ? 'bg-pink-50 text-rose-800 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <i className={`${item.icon} text-base w-4 h-4 shrink-0 flex items-center justify-center`}></i>
                    <span className="truncate">{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link
              href="/"
              target="_blank"
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-external-link-line text-base w-4 h-4 flex items-center justify-center"></i>
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-3 py-2.5 lg:px-5 flex items-center justify-between gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <i className={`${isSidebarOpen ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'} text-lg`}></i>
            </button>

            <div className="flex items-center gap-1.5 lg:gap-3">
              <button
                type="button"
                className="relative w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <i className="ri-notification-3-line text-lg"></i>
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              </button>

              <div className="relative user-menu-container">
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-800 rounded-full text-xs font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="text-left hidden md:block min-w-0">
                    <p className="text-xs font-semibold text-gray-900 capitalize leading-tight">{userRole || 'Admin'}</p>
                    <p className="text-[11px] text-gray-500 max-w-[140px] truncate leading-tight">{user?.email}</p>
                  </div>
                  <i className="ri-arrow-down-s-line text-gray-600 text-sm hidden sm:block"></i>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20 text-sm">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                    >
                      <i className="ri-logout-box-line text-red-600 w-4 h-4 flex items-center justify-center"></i>
                      <span className="text-red-600 text-xs font-medium">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="w-full max-w-[min(100%,1600px)] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
