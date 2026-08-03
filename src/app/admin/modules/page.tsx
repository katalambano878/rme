'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  category: string;
}

/** Icon badge: small circle, pale pink / soft accents (readable on white cards). */
const colorMap: Record<string, string> = {
  red: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  blue: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  purple: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  teal: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  orange: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  amber: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  yellow: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  indigo: 'bg-pink-50 text-rose-700 ring-1 ring-rose-100',
  gray: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

export default function ModulesPage() {
  const [loading, setLoading] = useState(true);

  // Base definitions of modules
  const [modules, setModules] = useState<Module[]>([
    {
      id: 'notifications',
      name: 'Marketing Notifications',
      description: 'Send Email and SMS campaigns to customers',
      icon: 'ri-notification-3-line',
      color: 'red',
      enabled: false,
      category: 'Marketing'
    },
    {
      id: 'cms',
      name: 'CMS / Pages',
      description: 'Manage website content, policies, and landing pages',
      icon: 'ri-file-list-line',
      color: 'blue',
      enabled: false,
      category: 'Content'
    },
    {
      id: 'homepage',
      name: 'Homepage Config',
      description: 'Customize homepage sections and banners',
      icon: 'ri-home-gear-line',
      color: 'purple',
      enabled: false,
      category: 'Content'
    },
    {
      id: 'blog',
      name: 'Blog Management',
      description: 'Create and manage blog posts',
      icon: 'ri-article-line',
      color: 'teal',
      enabled: false,
      category: 'Marketing'
    },
    {
      id: 'customer-insights',
      name: 'Customer Insights',
      description: 'Advanced analytics on customer behavior',
      icon: 'ri-user-search-line',
      color: 'orange',
      enabled: false,
      category: 'Analytics'
    },
    {
      id: 'flash-sales',
      name: 'Flash Sales',
      description: 'Time-limited promotional sales with countdown timers',
      icon: 'ri-flashlight-line',
      color: 'amber',
      enabled: false,
      category: 'Marketing'
    },
    {
      id: 'loyalty-program',
      name: 'Loyalty Program',
      description: 'Points and rewards system for customer retention',
      icon: 'ri-trophy-line',
      color: 'yellow',
      enabled: false,
      category: 'Marketing'
    },
    {
      id: 'pwa-settings',
      name: 'PWA / Mobile App',
      description: 'Configure Progressive Web App settings',
      icon: 'ri-smartphone-line',
      color: 'indigo',
      enabled: false,
      category: 'Mobile'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchModuleStates();
  }, []);

  const fetchModuleStates = async () => {
    try {
      const res = await api<{ data: { module_key: string; enabled: boolean }[] }>('/api/admin/modules').catch(
        (err) => {
          if (err instanceof ApiError && err.status === 501) return { data: [] };
          throw err;
        },
      );
      const data = res.data;
      if (data) {
        setModules(prev => prev.map(m => {
          const dbState = data.find((d) => d.module_key === m.id);
          return dbState ? { ...m, enabled: dbState.enabled } : m;
        }));
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (id: string, currentState: boolean) => {
    const newState = !currentState

    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: newState } : m)),
    )

    try {
      await api('/api/admin/modules', {
        method: 'POST',
        json: { module_key: id, enabled: newState },
      }).catch((err) => {
        if (err instanceof ApiError && err.status === 501) return;
        throw err;
      });
    } catch (err) {
      console.error('Error updating module:', err)
      setModules((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: currentState } : m)),
      )
      alert('Failed to update settings. Module table may not be set up yet.')
    }
  }

  const categories = ['all', ...Array.from(new Set(modules.map(m => m.category)))];

  /* Lock Screen Logic */
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '6526') {
      setIsLocked(false);
    } else {
      setPinError('Incorrect PIN');
      setPin('');
    }
  };

  if (isLocked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-lock-2-line text-4xl text-rose-600"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restricted Access</h2>
          <p className="text-gray-500 mb-8">Please enter the security PIN to access Modules.</p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError('');
                }}
                className="w-full text-center text-3xl font-bold tracking-widest px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 outline-none transition-all"
                placeholder="• • • •"
                maxLength={4}
                autoFocus
              />
            </div>
            {pinError && (
              <p className="text-red-500 text-sm font-medium animate-pulse">{pinError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-gray-900 hover:bg-rose-600 text-white font-bold py-4 rounded-xl transition-colors text-lg"
            >
              Unlock Dashboard
            </button>
          </form>

        </div>
      </div>
    );
  }

  const filteredModules = modules.filter(module => {
    const matchesSearch = module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || module.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedModules = filteredModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof modules>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Modules & Features</h1>
        <p className="text-gray-600 mb-8">Enable or disable features to customize your admin dashboard.</p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg outline-none"
            >
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading modules...</div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedModules).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-pink-200 pl-3">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {items.map((module) => (
                    <div
                      key={module.id}
                      className={`bg-white rounded-xl border-2 p-6 min-w-0 transition-all ${
                        module.enabled
                          ? 'border-rose-300 shadow-md opacity-100'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3 mb-4">
                        <div
                          className={`size-9 shrink-0 rounded-full flex items-center justify-center ${colorMap[module.color] || 'bg-gray-100 text-gray-600'}`}
                          aria-hidden
                        >
                          <i className={`${module.icon} text-lg`} />
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={module.enabled}
                          aria-label={`${module.enabled ? 'Disable' : 'Enable'} ${module.name}`}
                          onClick={() => toggleModule(module.id, module.enabled)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 ${
                            module.enabled ? 'bg-rose-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
                              module.enabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 pr-2">{module.name}</h3>
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{module.description}</p>
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            module.enabled ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {module.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
