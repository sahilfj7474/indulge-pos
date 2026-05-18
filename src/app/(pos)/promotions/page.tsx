'use client'

import { useState, useEffect } from 'react'
import { Promotion, getPromotions, createPromotion, updatePromotion, deletePromotion } from '@/lib/services/promotions.service'
import { getCategories } from '@/lib/services/admin.service'
import { getAllProducts } from '@/lib/services/admin.service'
import { Category, Product } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const EMPTY: Omit<Promotion, 'id' | 'created_at'> = {
  name: '', type: 'percentage', discount_value: 0,
  applies_to: 'all', category_id: null, product_id: null,
  min_purchase: 0, start_date: null, end_date: null, is_active: true,
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [promos, cats, prods] = await Promise.all([getPromotions(), getCategories(), getAllProducts()])
    setPromotions(promos)
    setCategories(cats)
    setProducts(prods)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(p: Promotion) {
    setEditing(p)
    setForm({ name: p.name, type: p.type, discount_value: p.discount_value, applies_to: p.applies_to,
      category_id: p.category_id, product_id: p.product_id, min_purchase: p.min_purchase,
      start_date: p.start_date, end_date: p.end_date, is_active: p.is_active })
    setShowModal(true)
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.discount_value <= 0) { toast.error('Discount value must be > 0'); return }
    setSaving(true)
    try {
      if (editing) {
        await updatePromotion(editing.id, form)
        toast.success('Promotion updated')
      } else {
        await createPromotion(form)
        toast.success('Promotion created')
      }
      setShowModal(false)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Promotion) {
    if (!confirm(`Delete "${p.name}"?`)) return
    await deletePromotion(p.id)
    toast.success('Deleted')
    load()
  }

  async function toggleActive(p: Promotion) {
    await updatePromotion(p.id, { is_active: !p.is_active })
    load()
  }

  const today = new Date().toISOString().slice(0, 10)

  function isLive(p: Promotion) {
    if (!p.is_active) return false
    if (p.start_date && p.start_date > today) return false
    if (p.end_date && p.end_date < today) return false
    return true
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promotions & Discounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Auto-applied at POS when conditions are met</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Promotion
        </button>
      </div>

      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Discount</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Applies To</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date Range</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : promotions.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No promotions yet</td></tr>
            ) : promotions.map(p => (
              <tr key={p.id} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    {isLive(p) && <Zap size={12} className="text-green-400" />}
                    {p.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {p.type === 'percentage' ? `${p.discount_value}% off` : `-${formatCurrency(p.discount_value)}`}
                  {p.min_purchase > 0 && <span className="text-xs text-slate-400 ml-1">(min {formatCurrency(p.min_purchase)})</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 capitalize">
                  {p.applies_to === 'all' ? 'All products' :
                   p.applies_to === 'category' ? `Category: ${categories.find(c => c.id === p.category_id)?.name ?? '—'}` :
                   `Product: ${products.find(pr => pr.id === p.product_id)?.name ?? '—'}`}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {p.start_date || p.end_date
                    ? `${p.start_date ?? '∞'} → ${p.end_date ?? '∞'}`
                    : 'Always'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                    isLive(p) ? 'bg-green-900/50 text-green-400' :
                    p.is_active ? 'bg-amber-900/40 text-amber-400' : 'bg-blue-50 text-slate-400'
                  )}>
                    {isLive(p) ? 'Live' : p.is_active ? 'Scheduled' : 'Off'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => toggleActive(p)} title={p.is_active ? 'Disable' : 'Enable'}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded transition-colors">
                      {p.is_active ? <ToggleRight size={15} className="text-green-400" /> : <ToggleLeft size={15} />}
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(p)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-blue-100 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Promotion' : 'Add Promotion'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Promotion Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Weekend 10% Off" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value as 'percentage' | 'fixed')}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Discount {form.type === 'percentage' ? '(%)' : '($)'} *
                </label>
                <input type="number" min="0" step="0.01" value={form.discount_value || ''}
                  onChange={e => set('discount_value', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Applies To</label>
              <select value={form.applies_to} onChange={e => set('applies_to', e.target.value as 'all' | 'category' | 'product')}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Products</option>
                <option value="category">Specific Category</option>
                <option value="product">Specific Product</option>
              </select>
            </div>

            {form.applies_to === 'category' && (
              <div>
                <label className="block text-sm text-slate-500 mb-1">Category</label>
                <select value={form.category_id ?? ''} onChange={e => set('category_id', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {form.applies_to === 'product' && (
              <div>
                <label className="block text-sm text-slate-500 mb-1">Product</label>
                <select value={form.product_id ?? ''} onChange={e => set('product_id', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-500 mb-1">Minimum Purchase ($)</label>
              <input type="number" min="0" step="0.01" value={form.min_purchase || ''}
                onChange={e => set('min_purchase', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 = no minimum" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Start Date</label>
                <input type="date" value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">End Date</label>
                <input type="date" value={form.end_date ?? ''} onChange={e => set('end_date', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="promo_active" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="promo_active" className="text-sm text-slate-600">Active</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}