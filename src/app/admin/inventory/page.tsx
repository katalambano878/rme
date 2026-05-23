'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { buildDisplaySku } from '@/lib/sku-display';
import { listPriceFromProduct, listSkuRaw, listStockFromProduct } from '@/lib/product-metrics';

export default function InventoryManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          sku,
          price,
          quantity,
          categories(name),
          variants(sku, price, stock_quantity)
        `)
        .order('name');

      if (error) throw error;

      if (data) {
        const mapped = data.map((p: any) => {
          const variants = p.variants || [];
          const stock = listStockFromProduct(p);
          const price = listPriceFromProduct(p);
          const rawSku = listSkuRaw(p);
          const sku = rawSku || 'N/A';
          const displaySku = buildDisplaySku(p.name, rawSku);
          const threshold = 10;

          let status = 'good';
          if (stock === 0) status = 'out';
          else if (stock < threshold) status = 'low';

          // PostgREST relation can come back as object or array.
          const categoryName = Array.isArray(p.categories)
            ? p.categories?.[0]?.name
            : p.categories?.name;

          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku,
            displaySku,
            category: categoryName || 'Uncategorized',
            currentStock: stock,
            reorderLevel: threshold,
            reorderQuantity: 50, // Default
            price,
            cost: 0, // Not in DB
            status,
            supplier: 'Standard Supplier' // Default
          };
        });
        setProducts(mapped);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.displaySku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = stockFilter === 'all' ||
      (stockFilter === 'low' && product.status === 'low') ||
      (stockFilter === 'out' && product.status === 'out') ||
      (stockFilter === 'good' && product.status === 'good');
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = products.filter(p => p.status === 'low').length;
  const outOfStockCount = products.filter(p => p.status === 'out').length;
  const totalValue = products.reduce((sum, p) => sum + (p.currentStock * p.price), 0); // Using Price as Value

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkRestock = () => {
    // Placeholder for bulk restock logic
    alert("Bulk restock feature coming soon (requires backend logic).");
    setSelectedProducts([]);
  };

  const handleExportCSV = () => {
    const csvData = [
      ['SKU', 'Product Name', 'Category', 'Current Stock', 'Price (GHS)', 'Status'],
      ...filteredProducts.map(p => [
        p.sku,
        p.name,
        p.category,
        p.currentStock.toString(),
        p.price.toFixed(2),
        p.status
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setShowExportModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1 text-xs md:text-sm">Track stock levels, manage reorders, and forecast demand</p>
        </div>
        <Link
          href="/admin"
          className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap text-center"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 mb-0.5">Total Products</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 tabular-nums">{products.length}</p>
              </div>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-rose-100 rounded-md">
                <i className="ri-stack-line text-lg text-rose-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 mb-0.5">Low Stock</p>
                <p className="text-xl md:text-2xl font-bold text-amber-600 tabular-nums">{lowStockCount}</p>
              </div>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-amber-100 rounded-md">
                <i className="ri-alert-line text-lg text-amber-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 mb-0.5">Out of Stock</p>
                <p className="text-xl md:text-2xl font-bold text-red-600 tabular-nums">{outOfStockCount}</p>
              </div>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-red-100 rounded-md">
                <i className="ri-close-circle-line text-lg text-red-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 mb-0.5">Total Retail Value</p>
                <p className="text-lg md:text-xl font-bold text-rose-600 tabular-nums truncate">
                  GH₵{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-rose-100 rounded-md">
                <i className="ri-money-dollar-circle-line text-lg text-rose-600"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base flex items-center justify-center"></i>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-rose-400 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                {['all', 'low', 'out', 'good'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStockFilter(filter)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${stockFilter === filter
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {filter === 'all' && 'All'}
                    {filter === 'low' && 'Low'}
                    {filter === 'out' && 'Out'}
                    {filter === 'good' && 'In Stock'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowImportModal(true)}
                className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-upload-line text-sm"></i>
                <span>Import</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line text-sm"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          {selectedProducts.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-4 bg-pink-50 border border-rose-200 rounded-lg">
              <p className="text-rose-900 font-medium">
                {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBulkRestock}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  Bulk Restock
                </button>
                <button
                  onClick={() => setSelectedProducts([])}
                  className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-8" />
                <col className="min-w-0" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[8%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[72px]" />
              </colgroup>
              <thead className="bg-gray-50/90 border-b border-gray-200">
                <tr>
                  <th className="pl-2 pr-1 py-2 text-left align-middle">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleAllProducts}
                      className="w-3.5 h-3.5 text-rose-600 rounded border-gray-300 cursor-pointer focus:ring-rose-400"
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Product</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">SKU</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Category</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Stock</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Retail</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="pl-2 pr-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-500 text-xs">Loading inventory...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-500 text-xs">No products found.</td></tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="pl-2 pr-1 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-3.5 h-3.5 text-rose-600 rounded border-gray-300 cursor-pointer focus:ring-rose-400"
                        />
                      </td>
                      <td className="px-2 py-2 align-top min-w-0 max-w-0">
                        <p className="font-medium text-gray-900 leading-tight line-clamp-2 break-words" title={product.name}>
                          {product.name}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={product.supplier}>
                          {product.supplier}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-gray-600 font-mono text-[11px] truncate align-top" title={product.displaySku}>
                        {product.displaySku}
                      </td>
                      <td className="px-2 py-2 text-gray-600 truncate align-top" title={product.category}>
                        {product.category}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span className="font-medium tabular-nums text-gray-900">{product.currentStock}</span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span className="font-medium tabular-nums text-gray-900 text-[11px]">
                          GH₵{(product.currentStock * product.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        {product.status === 'good' && (
                          <div className="inline-flex items-center gap-1.5" role="status" aria-label="In Stock">
                            <span
                              className="size-6 shrink-0 rounded-full bg-pink-100 border border-rose-200/80 flex items-center justify-center text-rose-600"
                              title="In Stock"
                            >
                              <i className="ri-check-line text-sm font-bold" aria-hidden />
                            </span>
                            <span className="text-[11px] font-medium text-gray-600 hidden sm:inline truncate">OK</span>
                          </div>
                        )}
                        {product.status === 'low' && (
                          <div className="inline-flex items-center gap-1.5" role="status" aria-label="Low Stock">
                            <span
                              className="size-6 shrink-0 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600"
                              title="Low Stock"
                            >
                              <i className="ri-alert-line text-sm" aria-hidden />
                            </span>
                            <span className="text-[11px] font-medium text-gray-600 hidden sm:inline truncate">Low</span>
                          </div>
                        )}
                        {product.status === 'out' && (
                          <div className="inline-flex items-center gap-1.5" role="status" aria-label="Out of Stock">
                            <span
                              className="size-6 shrink-0 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600"
                              title="Out of Stock"
                            >
                              <i className="ri-close-line text-sm" aria-hidden />
                            </span>
                            <span className="text-[11px] font-medium text-gray-600 hidden sm:inline truncate">Out</span>
                          </div>
                        )}
                      </td>
                      <td className="pl-2 pr-2 py-2 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="size-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-rose-700 hover:bg-pink-50 transition-colors"
                            title="Edit"
                          >
                            <i className="ri-edit-line text-base" aria-hidden />
                            <span className="sr-only">Edit</span>
                          </Link>
                          {product.slug ? (
                            <Link
                              href={`/products/${product.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="size-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-rose-700 hover:bg-pink-50 transition-colors"
                              title="View"
                            >
                              <i className="ri-eye-line text-base" aria-hidden />
                              <span className="sr-only">View product</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="size-7 inline-flex items-center justify-center rounded-md text-gray-300 cursor-not-allowed"
                              title="No slug"
                            >
                              <i className="ri-eye-line text-base" aria-hidden />
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
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Export Inventory</h2>
              <button onClick={() => setShowExportModal(false)} className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <i className="ri-close-line text-xl text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Exports <strong>{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? 's' : ''} currently shown (filter: <em>{stockFilter}</em>) as a CSV file.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 font-mono">
              SKU, Product Name, Category, Stock, Price, Status
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowExportModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleExportCSV}
                className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <i className="ri-download-line mr-1" /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
