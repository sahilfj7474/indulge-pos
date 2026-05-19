'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Product, Category } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { getAllProducts, getCategories, deleteProduct, updateProduct } from '@/lib/services/admin.service'
import { getInventoryStockMap } from '@/lib/services/inventory.service'
import { formatCurrency, formatDateTime, exportToCSV, cn } from '@/lib/utils'
import ProductModal from '@/components/products/ProductModal'
import CategoryModal from '@/components/products/CategoryModal'
import BarcodeLabelModal from '@/components/products/BarcodeLabelModal'
import { Plus, Pencil, Trash2, Search, Barcode, Download, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const ITEMS_PER_PAGE = 20

export default function ProductsPage() {
  const { user } = useAuth()
  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stockMap,   setStockMap]   = useState<Map<string, number>>(new Map())
  const [loading,    setLoading]    = useState(true)
  const [search,          setSearch]          = useState('')
  const [filterCategory,  setFilterCategory]  = useState<string | null>(null)
  const [filterActive,    setFilterActive]    = useState<'all' | 'active' | 'inactive'>('all')
  const [page,            setPage]            = useState(1)

  const [showProductModal,  setShowProductModal]  = useState(false)
  const [editingProduct,    setEditingProduct]    = useState<Product | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory,   setEditingCategory]   = useState<Category | null>(null)
  const [labelProduct,      setLabelProduct]      = useState<Product | null>(null)
  const [tab, setTab] = useState<'products' | 'categories'>('products')

  async function load() {
    const locationId = user?.location_id
    const [prods, cats, stock] = await Promise.all([
      getAllProducts(),
      getCategories(),
      locationId ? getInventoryStockMap(locationId) : Promise.resolve(new Map<string, number>()),
    ])
    setProducts(prods)
    setCategories(cats)
    setStockMap(stock)
    setLoading(false)
  }

  useEffect(() => { if (user !== undefined) load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    setPage(1)
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.sku?.toLowerCase().includes(search.toLowerCase()) &&
          !p.barcode?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCategory && p.category_id !== filterCategory) return false
      if (filterActive === 'active'   && !p.is_active) return false
      if (filterActive === 'inactive' &&  p.is_active) return false
      return true
    })
  }, [products, search, filterCategory, filterActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages  = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated   = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(product.id)
      toast.success('Product deleted')
      load()
    } catch {
      toast.error('Cannot delete — product may have sales records')
    }
  }

  async function handleToggleStatus(product: Product) {
    const next = !product.is_active
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: next } : p))
    try {
      await updateProduct(product.id, { is_active: next })
      toast.success(next ? 'Product activated' : 'Product deactivated')
    } catch {
      // Revert
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !next } : p))
      toast.error('Failed to update status')
    }
  }

  function handleExport() {
    exportToCSV(filtered.map(p => ({
      'Name':      p.name,
      'SKU':       p.sku ?? '',
      'Barcode':   p.barcode ?? '',
      'Category':  p.category?.name ?? '',
      'Price':     p.price,
      'Cost':      p.cost ?? '',
      'Stock':     stockMap.get(p.id) ?? 0,
      'Status':    p.is_active ? 'Active' : 'Inactive',
      'Created':   formatDateTime(p.created_at),
    })), 'products-export')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} total products</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
          {tab === 'categories' ? (
            <button
              onClick={() => { setEditingCategory(null); setShowCategoryModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Category
            </button>
          ) : (
            <button
              onClick={() => { setEditingProduct(null); setShowProductModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-lg w-fit border border-blue-100">
        {(['products', 'categories'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
              tab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, SKU, barcode..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={filterCategory ?? ''}
              onChange={e => setFilterCategory(e.target.value || null)}
              className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterActive}
              onChange={e => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-100">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium w-12"></th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Category</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Price</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Cost</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Stock</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Created</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-400">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-400">No products found</td></tr>
                ) : paginated.map(product => {
                  const stock = stockMap.get(product.id) ?? 0
                  return (
                    <tr key={product.id} className="border-b border-blue-200/50 hover:bg-blue-50/30 transition-colors">
                      {/* Thumbnail */}
                      <td className="px-4 py-2">
                        {product.image_url ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-blue-100 bg-white flex-shrink-0">
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-contain p-0.5"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-blue-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-2 text-slate-500 font-mono text-xs">{product.sku ?? '—'}</td>
                      <td className="px-4 py-2">
                        {product.category ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: product.category.color ?? '#6366f1' }}
                          >
                            {product.category.name}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-900 font-medium">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {product.cost ? formatCurrency(product.cost) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={cn(
                          'font-semibold',
                          stock === 0 ? 'text-red-500' : stock <= 10 ? 'text-amber-600' : 'text-slate-700'
                        )}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">
                        {formatDateTime(product.created_at)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleToggleStatus(product)}
                          title="Click to toggle status"
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                            product.is_active
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          )}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Print barcode label"
                            onClick={() => setLabelProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Barcode size={13} />
                          </button>
                          <button
                            onClick={() => { setEditingProduct(product); setShowProductModal(true) }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | '...')[]>((acc, n, i, arr) => {
                    if (i > 0 && (arr[i - 1] as number) < n - 1) acc.push('...')
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === '...' ? (
                      <span key={`dots-${i}`} className="px-1">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={cn(
                          'w-8 h-8 rounded text-xs font-medium transition-colors',
                          page === n ? 'bg-blue-600 text-white' : 'hover:bg-blue-100 text-slate-600'
                        )}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border border-blue-100 rounded-xl p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color ?? '#6366f1' }} />
                <span className="text-sm font-medium text-slate-900">{cat.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingCategory(cat); setShowCategoryModal(true) }}
                  className="p-1 text-slate-500 hover:text-slate-800"
                >
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && !loading && (
            <div className="col-span-4 text-center py-12 text-slate-400 text-sm">
              No categories yet. Add one to get started.
            </div>
          )}
        </div>
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => setShowProductModal(false)}
          onSaved={load}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
          onSaved={load}
        />
      )}

      {labelProduct && (
        <BarcodeLabelModal product={labelProduct} onClose={() => setLabelProduct(null)} />
      )}
    </div>
  )
}
