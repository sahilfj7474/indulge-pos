'use client'

import { useState } from 'react'
import { InventoryItem } from '@/types'
import { adjustInventory } from '@/lib/services/inventory.service'
import Modal from '@/components/ui/Modal'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  item: InventoryItem
  userId: string
  onClose: () => void
  onSaved: () => void
}

const REASONS = [
  'Stock received',
  'Stock count correction',
  'Damaged / expired',
  'Return to supplier',
  'Internal use',
  'Other',
]

export default function AdjustmentModal({ item, userId, onClose, onSaved }: Props) {
  const [type, setType] = useState<'add' | 'remove'>('add')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [saving, setSaving] = useState(false)

  const change = parseInt(qty) || 0
  const newQty = type === 'add'
    ? item.quantity + change
    : Math.max(0, item.quantity - change)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!change) { toast.error('Enter a quantity'); return }
    const finalReason = reason === 'Other' ? customReason.trim() : reason
    if (!finalReason) { toast.error('Enter a reason'); return }

    setSaving(true)
    try {
      await adjustInventory({
        productId: item.product_id,
        locationId: item.location_id,
        userId,
        quantityChange: type === 'add' ? change : -change,
        reason: finalReason,
      })
      toast.success('Stock adjusted')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Adjust Stock" onClose={onClose}>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-slate-900">{item.product?.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">Current stock: <span className="text-slate-900 font-semibold">{item.quantity}</span> units</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Add / Remove toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('add')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors',
              type === 'add'
                ? 'bg-green-600 border-green-500 text-white'
                : 'bg-blue-50 border-blue-200 text-slate-500 hover:text-slate-800'
            )}
          >
            <Plus size={15} /> Add Stock
          </button>
          <button
            type="button"
            onClick={() => setType('remove')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors',
              type === 'remove'
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-blue-50 border-blue-200 text-slate-500 hover:text-slate-800'
            )}
          >
            <Minus size={15} /> Remove Stock
          </button>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm text-slate-500 mb-1">Quantity *</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={e => setQty(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          {change > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              New stock level: <span className={cn('font-semibold', newQty < item.low_stock_threshold ? 'text-red-400' : 'text-green-400')}>{newQty}</span>
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm text-slate-500 mb-1">Reason *</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {reason === 'Other' && (
            <input
              type="text"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              className="w-full mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe reason..."
            />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Confirm Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}