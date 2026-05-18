'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getStockTransfers, createStockTransfer, completeStockTransfer, cancelStockTransfer
} from '@/lib/services/stock-transfers.service'
import { StockTransfer, Location, Product } from '@/types'
import { getLocations } from '@/lib/services/admin.service'
import { getActiveProducts } from '@/lib/services/products.service'
import { formatDateTime, cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, CheckCircle, X, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-900/50 text-yellow-400',
  completed: 'bg-green-900/50 text-green-400',
  cancelled: 'bg-blue-100 text-slate-500',
}

export default function StockTransfersPage() {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // New transfer form
  const [showNew, setShowNew] = useState(false)
  const [toLocationId, setToLocationId] = useState('')
  const [tfNotes, setTfNotes] = useState('')
  const [tfItems, setTfItems] = useState<{ product_id: string; quantity: number }[]>([{ product_id: '', quantity: 1 }])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    const [tf, locs, prods] = await Promise.all([
      getStockTransfers(user.location_id),
      getLocations(),
      getActiveProducts(user.location_id),
    ])
    setTransfers(tf)
    setLocations(locs.filter(l => l.id !== user.location_id))
    setProducts(prods)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleCreate() {
    if (!toLocationId) { toast.error('Select destination location'); return }
    const validItems = tfItems.filter(i => i.product_id && i.quantity > 0)
    if (validItems.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await createStockTransfer(user!.location_id!, toLocationId, user!.id, tfNotes, validItems)
      toast.success('Transfer created')
      setShowNew(false)
      setToLocationId('')
      setTfNotes('')
      setTfItems([{ product_id: '', quantity: 1 }])
      load()
    } catch { toast.error('Failed to create transfer') } finally { setSaving(false) }
  }

  async function handleComplete(t: StockTransfer) {
    if (!confirm('Complete this transfer? Inventory will be adjusted.')) return
    try {
      await completeStockTransfer(t.id, user!.id)
      toast.success('Transfer completed')
      load()
    } catch { toast.error('Failed to complete') }
  }

  async function handleCancel(t: StockTransfer) {
    if (!confirm('Cancel this transfer?')) return
    try { await cancelStockTransfer(t.id); toast.success('Cancelled'); load() }
    catch { toast.error('Failed to cancel') }
  }

  const fromLocationName = user?.location?.name ?? 'Your Location'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Transfers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Move stock between locations</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus size={14} /> New Transfer
        </button>
      </div>

      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">From → To</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Notes</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400">No transfers yet</td></tr>
            ) : transfers.map(t => (
              <tr key={t.id} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                <td className="px-4 py-3 text-slate-900">
                  <span className="flex items-center gap-1.5">
                    {(t.from_location as unknown as { name: string })?.name}
                    <ArrowRight size={12} className="text-slate-400" />
                    {(t.to_location as unknown as { name: string })?.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(t.created_at)}</td>
                <td className="px-4 py-3 text-slate-500">{t.notes ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[t.status])}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {t.status === 'pending' && (
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => handleComplete(t)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-800 hover:bg-green-700 text-green-300 text-xs rounded-lg">
                        <CheckCircle size={11} /> Complete
                      </button>
                      <button onClick={() => handleCancel(t)}
                        className="p-1 text-slate-400 hover:text-red-400"><X size={13} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="New Stock Transfer" onClose={() => setShowNew(false)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">From</label>
              <div className="px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg text-slate-600 text-sm">{fromLocationName}</div>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">To Location *</label>
              <select value={toLocationId} onChange={e => setToLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select location...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-500">Items</label>
                <button onClick={() => setTfItems(prev => [...prev, { product_id: '', quantity: 1 }])}
                  className="text-xs text-blue-500 hover:text-blue-400">+ Add item</button>
              </div>
              <div className="space-y-2">
                {tfItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={item.product_id} onChange={e => setTfItems(prev => { const u=[...prev]; u[i]={...u[i],product_id:e.target.value}; return u })}
                      className="flex-1 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min={1} value={item.quantity} onChange={e => setTfItems(prev => { const u=[...prev]; u[i]={...u[i],quantity:parseInt(e.target.value)||1}; return u })}
                      className="w-16 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    {tfItems.length > 1 && (
                      <button onClick={() => setTfItems(prev => prev.filter((_,j)=>j!==i))} className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Notes</label>
              <input type="text" value={tfNotes} onChange={e => setTfNotes(e.target.value)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {saving ? 'Creating...' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}