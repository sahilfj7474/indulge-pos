'use client'

import { useState } from 'react'
import { Sale } from '@/types'
import { createRefund, RefundItemInput } from '@/lib/services/refunds.service'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface Props {
  sale: Sale
  userId: string
  onClose: () => void
  onRefunded: () => void
}

export default function RefundModal({ sale, userId, onClose, onRefunded }: Props) {
  const saleItems = sale.items ?? []
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(saleItems.map(si => [si.id, 0]))
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const refundItems: RefundItemInput[] = saleItems
    .filter(si => (quantities[si.id] ?? 0) > 0)
    .map(si => ({
      sale_item_id: si.id,
      product_id: si.product_id,
      quantity: quantities[si.id],
      unit_price: si.unit_price,
    }))

  const refundTotal = refundItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  async function handleSubmit() {
    if (refundItems.length === 0) { toast.error('Select at least one item to refund'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    setSaving(true)
    try {
      await createRefund(sale.id, userId, refundItems, reason)
      toast.success(`Refund processed — ${formatCurrency(refundTotal)}`)
      onRefunded()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to process refund')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Process Refund" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Select items to refund from sale <span className="font-mono text-white">{sale.id.slice(0,8).toUpperCase()}</span></p>

        <div className="space-y-2">
          {saleItems.map(si => {
            const productName = (si.product as unknown as { name: string })?.name ?? si.product_id
            const qty = quantities[si.id] ?? 0
            return (
              <div key={si.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{productName}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(si.unit_price)} × {si.quantity} = {formatCurrency(si.total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Refund qty:</span>
                  <input
                    type="number"
                    min={0}
                    max={si.quantity}
                    value={qty || ''}
                    onChange={e => setQuantities(prev => ({ ...prev, [si.id]: Math.min(si.quantity, parseInt(e.target.value) || 0) }))}
                    className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Reason *</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Defective product, Customer changed mind"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {refundTotal > 0 && (
          <div className="flex justify-between text-sm border-t border-gray-700 pt-3">
            <span className="text-gray-400">Refund amount</span>
            <span className="text-red-400 font-bold">{formatCurrency(refundTotal)}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || refundItems.length === 0}
            className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors">
            {saving ? 'Processing...' : 'Process Refund'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
