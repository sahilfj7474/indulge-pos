'use client'

import { useState } from 'react'
import { InventoryItem } from '@/types'
import { setStockLevel } from '@/lib/services/inventory.service'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  item: InventoryItem
  userId: string
  onClose: () => void
  onSaved: () => void
}

export default function SetStockModal({ item, userId, onClose, onSaved }: Props) {
  const [qty, setQty] = useState(item.quantity.toString())
  const [reason, setReason] = useState('Stock count correction')
  const [saving, setSaving] = useState(false)

  const newQty = Math.max(0, parseInt(qty) || 0)
  const diff = newQty - item.quantity

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (qty === '') { toast.error('Enter a quantity'); return }

    setSaving(true)
    try {
      await setStockLevel(item.product_id, item.location_id, userId, newQty, reason)
      toast.success('Stock level set')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to set stock level')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Set Stock Level" onClose={onClose}>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-slate-900">{item.product?.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Current stock: <span className="text-slate-900 font-semibold">{item.quantity}</span> units
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-500 mb-1">New Stock Level *</label>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={e => setQty(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-2xl text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          {qty !== '' && diff !== 0 && (
            <p className={cn('text-xs mt-1', diff > 0 ? 'text-green-600' : 'text-red-500')}>
              {diff > 0 ? `+${diff}` : diff} from current ({item.quantity} → {newQty})
            </p>
          )}
          {diff === 0 && qty !== '' && (
            <p className="text-xs mt-1 text-slate-400">No change from current level</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Stock count correction</option>
            <option>Opening stock</option>
            <option>Stock received</option>
            <option>Manual stock set</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || diff === 0}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Set Level'}
          </button>
        </div>
      </form>
    </Modal>
  )
}