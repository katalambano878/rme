/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { canManageStaffRoles } from '@/lib/admin-role-access';
import {
  STAFF_PERMISSION_AREAS,
  defaultStaffPermissions,
  sanitizeStaffPermissions,
} from '@/lib/staff-permissions';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at?: string | null;
  permissions?: Record<string, unknown> | null;
};

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
];

function permissionsForEdit(row: ProfileRow): Record<string, boolean> {
  if (row.role !== 'staff') return defaultStaffPermissions();
  const p = row.permissions;
  if (!p || Object.keys(p).length === 0) return defaultStaffPermissions();
  return sanitizeStaffPermissions(p as Record<string, unknown>);
}

export default function AdminStaffPage() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeCustomers, setIncludeCustomers] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<'staff' | 'admin'>('staff');
  const [addPerms, setAddPerms] = useState<Record<string, boolean>>(() => defaultStaffPermissions());
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [permUser, setPermUser] = useState<ProfileRow | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, boolean>>(defaultStaffPermissions());
  const [permSaving, setPermSaving] = useState(false);

  const canEditRoles = canManageStaffRoles(myRole);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) setMyId(session.user.id);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session?.user?.id ?? '').maybeSingle();
      if (profile?.role) setMyRole(profile.role);
    })();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const first = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at, updated_at, permissions')
        .order('created_at', { ascending: false });
      const res =
        first.error && /permissions|schema cache/i.test(String(first.error.message))
          ? await supabase
              .from('profiles')
              .select('id, email, full_name, role, created_at, updated_at')
              .order('created_at', { ascending: false })
          : first;
      if (res.error) throw res.error;
      setRows((res.data as ProfileRow[]) ?? []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rows;
    if (!includeCustomers) {
      list = list.filter((r) => r.role !== 'customer');
    }
    if (!term) return list;
    return list.filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.full_name && r.full_name.toLowerCase().includes(term)) ||
        r.role.toLowerCase().includes(term),
    );
  }, [rows, search, includeCustomers]);

  const getSessionToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const updateRole = async (id: string, newRole: string) => {
    if (!canEditRoles) return;
    if (id === myId && newRole === 'customer') {
      if (!confirm('You are removing your own admin access. Continue?')) return;
    }
    try {
      setSavingId(id);
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role: newRole } : r)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not update role');
    } finally {
      setSavingId(null);
    }
  };

  const openPermModal = (row: ProfileRow) => {
    if (!canEditRoles || row.role !== 'staff') return;
    setPermUser(row);
    setPermDraft(permissionsForEdit(row));
  };

  const savePermModal = async () => {
    if (!permUser || !canEditRoles) return;
    if (!Object.values(permDraft).some(Boolean)) {
      alert('Select at least one area.');
      return;
    }
    try {
      setPermSaving(true);
      const token = await getSessionToken();
      if (!token) {
        alert('Not signed in.');
        return;
      }
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: permUser.id, permissions: permDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : 'Could not save permissions');
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === permUser.id ? { ...r, permissions: permDraft as unknown as Record<string, unknown> } : r)),
      );
      setPermUser(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setPermSaving(false);
    }
  };

  const submitAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditRoles) return;
    if (!addEmail.trim() || addPassword.length < 12) {
      alert('Enter a valid email and password (min 12 characters).');
      return;
    }
    if (addRole === 'staff' && !Object.values(addPerms).some(Boolean)) {
      alert('Select at least one area this staff member can access.');
      return;
    }
    if (addRole === 'admin' && myRole !== 'superadmin') {
      alert('Only a superadmin can create admin accounts.');
      return;
    }
    try {
      setAddSubmitting(true);
      const token = await getSessionToken();
      if (!token) {
        alert('Not signed in.');
        return;
      }
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: addEmail.trim(),
          password: addPassword,
          fullName: addName.trim() || undefined,
          role: addRole,
          permissions: addRole === 'staff' ? addPerms : defaultStaffPermissions(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : 'Could not create staff');
        return;
      }
      setShowAdd(false);
      setAddEmail('');
      setAddPassword('');
      setAddName('');
      setAddRole('staff');
      setAddPerms(defaultStaffPermissions());
      await fetchStaff();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create staff');
    } finally {
      setAddSubmitting(false);
    }
  };

  const deleteUser = async (r: ProfileRow) => {
    if (!canEditRoles) return;
    if (r.id === myId) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!confirm(`Delete ${r.email || r.full_name || 'this user'}? This cannot be undone.`)) return;
    try {
      setDeletingId(r.id);
      const token = await getSessionToken();
      if (!token) { alert('Not signed in.'); return; }
      const res = await fetch('/api/admin/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: r.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : 'Could not delete user');
        return;
      }
      setRows((prev) => prev.filter((p) => p.id !== r.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      superadmin: 'bg-violet-100 text-violet-900',
      admin: 'bg-rose-100 text-rose-900',
      staff: 'bg-blue-100 text-blue-900',
      customer: 'bg-gray-100 text-gray-700',
    };
    return map[role] ?? 'bg-gray-100 text-gray-700';
  };

  const permSummary = (r: ProfileRow) => {
    if (r.role !== 'staff') return '—';
    const p = r.permissions;
    if (!p || Object.keys(p).length === 0) return 'All areas (default)';
    const n = Object.values(p).filter((v) => v === true).length;
    return `${n} area${n === 1 ? '' : 's'}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-600 mt-1">
            Invite team members, set their role, and choose which admin areas they can open. Database access still follows Supabase RLS; these
            toggles control the admin sidebar and pages.
          </p>
        </div>
        {canEditRoles && (
          <button
            type="button"
            onClick={() => {
              setAddPerms(defaultStaffPermissions());
              setShowAdd(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 cursor-pointer"
          >
            <i className="ri-user-add-line text-lg" aria-hidden />
            Add staff
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg w-5 h-5 flex items-center justify-center"></i>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-rose-400 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCustomers}
            onChange={(e) => setIncludeCustomers(e.target.checked)}
            className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-400"
          />
          Include customers
        </label>
      </div>

      {!canEditRoles && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view this list. Only <strong>Admin</strong> or <strong>Superadmin</strong> can add staff or change roles and permissions.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Access</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Joined</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <i className="ri-loader-4-line animate-spin text-2xl inline-block mr-2"></i>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No profiles match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="py-3 px-4 font-medium text-gray-900">{r.full_name || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{r.email || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge(r.role)}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{permSummary(r)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {canEditRoles && r.role === 'staff' && (
                          <button
                            type="button"
                            onClick={() => openPermModal(r)}
                            className="text-sm font-medium text-rose-700 hover:text-rose-900 underline-offset-2 hover:underline cursor-pointer"
                          >
                            Permissions
                          </button>
                        )}
                        {canEditRoles ? (
                          <select
                            value={r.role}
                            disabled={savingId === r.id}
                            onChange={(e) => updateRole(r.id, e.target.value)}
                            className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-rose-400 focus:border-rose-400 cursor-pointer disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                        {canEditRoles && r.id !== myId && r.role !== 'superadmin' && (
                          <button
                            type="button"
                            onClick={() => deleteUser(r)}
                            disabled={deletingId === r.id}
                            title="Delete user"
                            className="inline-flex items-center justify-center size-8 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 cursor-pointer"
                          >
                            {deletingId === r.id
                              ? <i className="ri-loader-4-line animate-spin text-lg" />
                              : <i className="ri-delete-bin-line text-lg" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500 max-w-3xl">
        New storefront signups are <strong>customers</strong> by default. Use <strong>Add staff</strong> to create an account with a password (requires{' '}
        <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> on the server). You can still promote existing customers by changing
        their role here. Superadmin accounts are normally assigned via the <code className="bg-gray-100 px-1 rounded">superadmins</code> table at signup.
      </p>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="add-staff-title">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 id="add-staff-title" className="text-lg font-bold text-gray-900">
                Add staff
              </h2>
              <button type="button" onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer" aria-label="Close">
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <form onSubmit={submitAddStaff} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">At least 12 characters. They can change it after signing in.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name (optional)</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'staff' | 'admin')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
                >
                  <option value="staff">Staff</option>
                  {myRole === 'superadmin' && <option value="admin">Admin</option>}
                </select>
                {myRole !== 'superadmin' && (
                  <p className="text-xs text-gray-500 mt-1">Only a superadmin can create admin accounts.</p>
                )}
              </div>
              {addRole === 'staff' && (
                <fieldset className="border border-gray-200 rounded-lg p-3">
                  <legend className="text-sm font-semibold text-gray-800 px-1">Admin areas</legend>
                  <p className="text-xs text-gray-600 mb-3">Uncheck sections this person should not see in the admin app.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {STAFF_PERMISSION_AREAS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addPerms[key] ?? false}
                          onChange={(e) => setAddPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-400"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {addSubmitting ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Permissions — {permUser.email || permUser.full_name || 'Staff'}</h2>
              <button
                type="button"
                onClick={() => setPermUser(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Choose which admin sections this staff member can open.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3">
                {STAFF_PERMISSION_AREAS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permDraft[key] ?? false}
                      onChange={(e) => setPermDraft((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-400"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPermUser(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePermModal}
                  disabled={permSaving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {permSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
