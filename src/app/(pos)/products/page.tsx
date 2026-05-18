'use client'

import { useState, useEffect, useMemo } from 'react'
import { Product, Category } from '@/types'
import { getAllProducts, getCategories, deleteProduct } from '@/lib/services/admin.service'
import { formatCurrency } from '@/lib/utils'
import ProductModal from '@/components/products/ProductModal'
import CategoryModal from '@/components/products/CategoryModal'
import { Plus, Pencil, Trash2, Search, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [tab, setTab] = useState<'products' | 'categories'>('products')

  async function load() {
    const [prods, cats] = await Promise.all([getAllProducts(), getCategories()])
    setProducts(prods)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.sku?.toLowerCase().includes(search.toLowerCase()) &&
          !p.barcode?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCategory && p.category_id !== filterCategory) return false
      if (filterActive === 'active' && !p.is_active) return false
      if (filterActive === 'inactive' && p.is_active) return false
      return true
    })
  }, [products, search, filterCategory, filterActive])

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Products</h1>
          <p className="text-sm text-gray-400 mt-0.5">{products.length} total products</p>
        </div>
        <div className="flex gap-2">
          {tab === 'categories' ? (
            <button
              onClick={() => { setEditingCategory(null); setShowCategoryModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Category
            </button>
          ) : (
            <button
              onClick={() => { setEditingProduct(null); setShowProductModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit border border-gray-800">
        {(['products', 'categories'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
              tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, SKU, barcode..."
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <select
              value={filterCategory ?? ''}
              onChange={e => setFilterCategory(e.target.value || null)}
              className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterActive}
              onChange={e => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Barcode</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Price</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Cost</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">No products found</td></tr>
                ) : filtered.map(product => (
                  <tr key={product.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{product.name}</td>
                    <td className="px-4 py-3 text-gray-400">{product.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{product.barcode ?? '—'}</td>
                    <td className="px-4 py-3">
                      {product.category ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs text-white"
                          style={{ backgroundColor: product.category.color ?? '#6366f1' }}
                        >
                          {product.category.name}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {product.cost ? formatCurrency(product.cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        product.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
                      )}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingProduct(product); setShowProductModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color ?? '#6366f1' }} />
                <span className="text-sm font-medium text-white">{cat.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingCategory(cat); setShowCategoryModal(true) }}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && !loading && (
            <div className="col-span-4 text-center py-12 text-gray-500 text-sm">
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
    </div>
  )
}
