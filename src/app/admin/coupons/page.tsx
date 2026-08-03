/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { discountRowToAdminCoupon } from '@/lib/discount-map';

export default function AdminCouponsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyForm = {
    code: '',
    discount_type: 'percent' as 'percent' | 'fixed' | 'free_shipping',
    value: '',
    min_spend: '',
    max_uses: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await api<any[]>('/api/admin/coupons');
      if (data) {
        setCoupons(data.map((row) => ({ ...discountRowToAdminCoupon(row), _raw: row })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    'Active': 'bg-rose-light text-navy',
    'Scheduled': 'bg-rose-light text-navy',
    'Expired': 'bg-gray-100 text-gray-700',
    'Disabled': 'bg-red-100 text-red-700',
  };

  const openAdd = () => {
    setForm(emptyForm);
    setShowAddModal(true);
  };

  const handleEdit = (coupon: any) => {
    const typeMap: Record<string, 'percent' | 'fixed' | 'free_shipping'> = {
      'Percentage': 'percent',
      'Fixed Amount': 'fixed',
      'Free Shipping': 'free_shipping',
    };
    setForm({
      code: coupon.code,
      discount_type: typeMap[coupon.type] ?? 'percent',
      value: coupon.value > 0 ? String(coupon.value) : '',
      min_spend: coupon.minPurchase > 0 ? String(coupon.minPurchase) : '',
      max_uses: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      starts_at: coupon._raw?.starts_at ? coupon._raw.starts_at.slice(0, 10) : '',
      ends_at: coupon._raw?.ends_at ? coupon._raw.ends_at.slice(0, 10) : '',
      is_active: coupon.status !== 'Disabled',
    });
    setEditingCoupon(coupon);
    setShowEditModal(true);
  };

  const saveCoupon = async () => {
    if (!form.code.trim()) { alert('Coupon code is required.'); return; }
    setSaving(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      value: form.value ? parseFloat(form.value) : null,
      min_spend: form.min_spend ? parseFloat(form.min_spend) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active,
    };
    try {
      if (showEditModal && editingCoupon) {
        await api(`/api/admin/coupons/${editingCoupon.id}`, { method: 'PATCH', json: payload });
      } else {
        await api('/api/admin/coupons', { method: 'POST', json: payload });
      }
    } catch (err) {
      setSaving(false);
      alert('Error saving coupon: ' + (err instanceof Error ? err.message : 'Unknown error'));
      return;
    }
    setSaving(false);
    setShowAddModal(false);
    setShowEditModal(false);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Error deleting coupon: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setDeletingId(null);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingCoupon(null);
  };

  const activeCoupons = coupons.filter(c => c.status === 'Active');
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-rose-light0 hover:bg-navy text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-navy">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Discount</p>
          <p className="text-2xl font-bold text-purple-700">--</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
            <div className="flex items-center space-x-3">
              <select className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary font-medium cursor-pointer">
                <option>All Status</option>
                <option>Active</option>
                <option>Scheduled</option>
                <option>Expired</option>
              </select>
              <select className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary font-medium cursor-pointer">
                <option>Sort by Date</option>
                <option>Sort by Usage</option>
                <option>Sort by Value</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Min Purchase</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading coupons...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No coupons found.</td></tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{coupon.code}</span>
                        <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-navy hover:bg-rose-light rounded transition-colors cursor-pointer">
                          <i className="ri-file-copy-line"></i>
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{coupon.type}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      {coupon.type === 'Percentage' ? `${coupon.value}%` : coupon.type === 'Fixed Amount' ? `GH₵ ${coupon.value}` : 'Free Shipping'}
                    </td>
                    <td className="py-4 px-4 text-gray-700 whitespace-nowrap">
                      {coupon.minPurchase > 0 ? `GH₵ ${coupon.minPurchase.toFixed(2)}` : 'No minimum'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900 font-semibold">{coupon.usedCount}</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-gray-600">{coupon.usageLimit || '∞'}</span>
                      </div>
                      {coupon.usageLimit && (
                        <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                          <div
                            className="h-full bg-rose-light0 rounded-full"
                            style={{ width: `${Math.min((coupon.usedCount / coupon.usageLimit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-700 whitespace-nowrap">{coupon.startDate}</p>
                      <p className="text-sm text-gray-500 whitespace-nowrap">{coupon.endDate || 'No expiry'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[coupon.status] || 'bg-gray-100'}`}>
                        {coupon.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-navy hover:bg-rose-light rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </button>
                        <button
                          onClick={() => deleteCoupon(coupon.id, coupon.code)}
                          disabled={deletingId === coupon.id}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {showEditModal ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Discount Type</label>
                <select
                  value={form.discount_type}
                  onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary cursor-pointer"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (GH₵)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>

              {form.discount_type !== 'free_shipping' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {form.discount_type === 'percent' ? 'Discount (%)' : 'Discount Amount (GH₵)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Min Purchase (GH₵)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_spend}
                    onChange={e => setForm(f => ({ ...f, min_spend: e.target.value }))}
                    placeholder="No minimum"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Max Uses</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_uses}
                    onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.starts_at}
                    onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.ends_at}
                    onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-rose-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 text-rose-primary border-gray-300 rounded focus:ring-navy cursor-pointer"
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 cursor-pointer">Active</label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-5 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveCoupon}
                disabled={saving}
                className="px-5 py-2 bg-rose-light0 hover:bg-navy text-white rounded-lg font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving…' : showEditModal ? 'Save Changes' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
