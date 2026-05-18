'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { voidSale } from '@/lib/services/sales.service'
import Modal from '@/components/ui/Modal'
import { Printer, Ban } from 'lucide-react'
import { TAX_RATE } from '@/components/pos/Cart'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  sale: Sale
  canVoid: boolean
  onClose: () => void
  onVoided: () => void
}

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-900/50 text-green-400',
  voided:         'bg-red-900/50 text-red-400',
  refunded:       'bg-yellow-900/50 text-yellow-400',
  partial_refund: 'bg-orange-900/50 text-orange-400',
}

export default function SaleDetailModal({ sale, canVoid, onClose, onVoided }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: receiptRef })

  async function handleVoid() {
    if (!confirm('Void this sale? This cannot be undone.')) return
    try {
      await voidSale(sale.id)
      toast.success('Sale voided')
      onVoided()
      onClose()
    } catch {
      toast.error('Failed to void sale')
    }
  }

  return (
    <Modal title={`Sale — ${sale.id.slice(0, 8).toUpperCase()}`} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Date</p>
            <p className="text-white">{formatDateTime(sale.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[sale.status] ?? '')}>
              {sale.status}
            </span>
          </div>
          <div>
            <p className="text-gray-500">Cashier</p>
            <p className="text-white">{(sale.user as unknown as { full_name: string })?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Customer</p>
            <p className="text-white">{(sale.customer as unknown as { full_name: string })?.full_name ?? 'Walk-in'}</p>
          </div>
          <div>
            <p className="text-gray-500">Payment</p>
            <p className="text-white capitalize">{sale.payment_method.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-gray-500">Location</p>
            <p className="text-white">{(sale.location as unknown as { name: string })?.name ?? '—'}</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-3 py-2 text-gray-400 font-medium">Item</th>
                <th className="text-right px-3 py-2 text-gray-400 font-medium">Qty</th>
                <th className="text-right px-3 py-2 text-gray-400 font-medium">Price</th>
                <th className="text-right px-3 py-2 text-gray-400 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).map(item => (
                <tr key={item.id} className="border-b border-gray-700/50">
                  <td className="px-3 py-2 text-white">{(item.product as unknown as { name: string })?.name}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatCurrency(item.unit_price)}</td>
                  <td className="px-3 py-2 text-right text-white">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount</span><span>-{formatCurrency(sale.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-400">
            <span>Tax ({(TAX_RATE * 100).toFixed(0)}% GST)</span>
            <span>{formatCurrency(sale.tax_amount)}</span>
          </div>
          <div className="flex justify-between font-bold text-white border-t border-gray-700 pt-1.5">
            <span>Total</span><span className="text-indigo-400">{formatCurrency(sale.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Printer size={14} /> Reprint
          </button>
          {canVoid && sale.status === 'completed' && (
            <button
              onClick={handleVoid}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/70 text-red-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Ban size={14} /> Void Sale
            </button>
          )}
        </div>
      </div>

      {/* Hidden print area */}
      <div className="hidden">
        <div ref={receiptRef} className="receipt-print bg-white text-black p-4 font-mono text-xs">
          <div className="text-center mb-3">
            <p className="text-base font-bold">{(sale.location as unknown as { name: string })?.name}</p>
            <p>{'='.repeat(36)}</p>
          </div>
          <p>{formatDateTime(sale.created_at)}</p>
          <p>Receipt: {sale.id.slice(0, 8).toUpperCase()}</p>
          <p>{'='.repeat(36)}</p>
          {(sale.items ?? []).map(item => (
            <div key={item.id}>
              <p>{(item.product as unknown as { name: string })?.name}</p>
              <div className="flex justify-between pl-2">
                <span>{item.quantity} x {formatCurrency(item.unit_price)}</span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
          <p>{'='.repeat(36)}</p>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
          {sale.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(sale.discount_amount)}</span></div>}
          <div className="flex justify-between"><span>Tax (9% GST)</span><span>{formatCurrency(sale.tax_amount)}</span></div>
          <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatCurrency(sale.total)}</span></div>
          <p>{'='.repeat(36)}</p>
          <p className="text-center">Thank you!</p>
        </div>
      </div>
    </Modal>
  )
}
