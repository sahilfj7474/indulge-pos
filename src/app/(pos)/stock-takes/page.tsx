'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getStockTakes, createStockTake, getStockTakeItems, updateStockTakeItem, completeStockTake, StockTakeItemRow
} from '@/lib/services/stock-takes.service'
import { StockTake } from '@/types'
import { formatDateTime, cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, CheckCircle, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StockTakesPage() {
  const { user } = useAuth()
  const [takes, setTakes] = useState<StockTake[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [notes, setNotes] = useState('')

  // Active stock take detail
  const [activeTake, setActiveTake] = useState<StockTake | null>(null)
  const [takeItems, setTakeItems] = useState<StockTakeItemRow[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [completing, setCompleting] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    setTakes(await getStockTakes(user.location_id))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleCreate() {
    if (!user?.location_id) return
    setCreating(true)
    try {
      const take = await createStockTake(user.location_id, user.id, notes)
      toast.success('Stock take created')
      setNotes('')
      await load()
      openTake({ ...take })
    } catch { toast.error('Failed to create stock take') } finally { setCreating(false) }
  }

  async function openTake(take: StockTake) {
    setActiveTake(take)
    setLoadingItems(true)
    const items = await getStockTakeItems(take.id)
    setTakeItems(items)
    setCounts(Object.fromEntries(items.map(i => [i.id, String(i.counted_qty)])))
    setLoadingItems(false)
  }

  async function handleUpdateCount(itemId: string, value: string) {
    setCounts(prev => ({ ...prev, [itemId]: value }))
    const qty = parseInt(value)
    if (!isNaN(qty) && qty >= 0) {
      await updateStockTakeItem(itemId, qty)
    }
  }

  async function handleComplete() {
    if (!activeTake || !user?.location_id) return
    if (!confirm('Complete this stock take? This will adjust inventory to match your counts.')) return
    setCompleting(true)
    try {
      await completeStockTake(activeTake.id, user.location_id, user.id)
      toast.success('Stock take completed — inventory updated')
      setActiveTake(null)
      load()
    } catch { toast.error('Failed to complete') } finally { setCompleting(false) }
  }

  const filteredItems = takeItems.filter(i =>
    !search || i.product.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.product.sku?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Takes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Count and reconcile your inventory</p>
        </div>
        {!activeTake && (
          <div className="flex gap-2">
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              <Plus size={14} /> {creating ? 'Creating...' : 'New Stock Take'}
            </button>
          </div>
        )}
        {activeTake && activeTake.status === 'in_progress' && (
          <div className="flex gap-2">
            <button onClick={() => setActiveTake(null)}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">
              Back
            </button>
            <button onClick={handleComplete} disabled={completing}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
              <CheckCircle size={14} /> {completing ? 'Completing...' : 'Complete & Adjust'}
            </button>
          </div>
        )}
      </div>

      {!activeTake ? (
        /* Stock take list */
        <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blue-100">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Notes</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Completed</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : takes.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">No stock takes yet</td></tr>
              ) : takes.map(t => (
                <tr key={t.id} className="border-b border-blue-200/50 hover:bg-blue-50/30 cursor-pointer" onClick={() => openTake(t)}>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatDateTime(t.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{t.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.completed_at ? formatDateTime(t.completed_at) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      t.status === 'in_progress' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400')}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500"><ChevronRight size={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Stock take detail */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {activeTake.status === 'in_progress' ? 'Enter your counted quantities below' : 'Completed stock take — read only'}
            </p>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter products..."
              className="px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48" />
          </div>

          {loadingItems ? (
            <div className="text-center py-12 text-slate-400">Loading items...</div>
          ) : (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">SKU</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Expected</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Counted</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const counted = parseInt(counts[item.id] ?? '')
                    const variance = isNaN(counted) ? item.variance : counted - item.expected_qty
                    return (
                      <tr key={item.id} className={cn('border-b border-blue-200/50', variance !== 0 && !isNaN(counted) ? 'bg-yellow-900/10' : '')}>
                        <td className="px-4 py-2 text-slate-900">{item.product.name}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs font-mono">{item.product.sku ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{item.expected_qty}</td>
                        <td className="px-4 py-2 text-right">
                          {activeTake.status === 'in_progress' ? (
                            <input
                              type="number"
                              min={0}
                              value={counts[item.id] ?? ''}
                              onChange={e => handleUpdateCount(item.id, e.target.value)}
                              className="w-20 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-slate-900 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-slate-900">{item.counted_qty}</span>
                          )}
                        </td>
                        <td className={cn('px-4 py-2 text-right font-medium', variance > 0 ? 'text-green-400' : variance < 0 ? 'text-red-400' : 'text-slate-400')}>
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}