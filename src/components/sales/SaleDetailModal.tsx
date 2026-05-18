'use client'

import { useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { voidSale } from '@/lib/services/sales.service'
import Modal from '@/components/ui/Modal'
import RefundModal from './RefundModal'
import { Printer, Ban, RotateCcw } from 'lucide-react'
import { DEFAULT_TAX_RATE as TAX_RATE } from '@/components/pos/Cart'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  sale: Sale
  userId: string
  canVoid: boolean
  canRefund: boolean
  onClose: () => void
  onVoided: () => void
  onRefunded: () => void
}

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-100 text-green-600',
  voided:         'bg-red-100 text-red-500',
  refunded:       'bg-yellow-100 text-yellow-700',
  partial_refund: 'bg-orange-900/50 text-orange-400',
}

export default function SaleDetailModal({ sale, userId, canVoid, canRefund, onClose, onVoided, onRefunded }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: receiptRef })
  const [showRefund, setShowRefund] = useState(false)

  const surcharge = (sale as any).surcharge_amount ?? 0
  const paymentDetails = (sale as any).payment_details

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

  if (showRefund) {
    return (
      <RefundModal
        sale={sale}
        userId={userId}
        onClose={() => setShowRefund(false)}
        onRefunded={() => { onRefunded(); setShowRefund(false) }}
      />
    )
  }

  return (
    <Modal title={`Sale — ${sale.id.slice(0, 8).toUpperCase()}`} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-400">Date</p>
            <p className="text-slate-900">{formatDateTime(sale.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-400">Status</p>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[sale.status] ?? '')}>
              {sale.status.replace('_', ' ')}
            </span>
          </div>
          <div>
            <p className="text-slate-400">Cashier</p>
            <p className="text-slate-900">{(sale.user as unknown as { full_name: string })?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400">Customer</p>
            <p className="text-slate-900">{(sale.customer as unknown as { full_name: string })?.full_name ?? 'Walk-in'}</p>
          </div>
          <div>
            <p className="text-slate-400">Payment</p>
            {paymentDetails?.splits ? (
              <div className="space-y-0.5">
                {paymentDetails.splits.map((sp: { method: string; amount: number }, i: number) => (
                  <p key={i} className="text-slate-900 capitalize text-xs">
                    {sp.method.replace('_', ' ')}: {formatCurrency(sp.amount)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-slate-900 capitalize">{sale.payment_method.replace('_', ' ')}</p>
            )}
          </div>
          <div>
            <p className="text-slate-400">Location</p>
            <p className="text-slate-900">{(sale.location as unknown as { name: string })?.name ?? '—'}</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-blue-50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Item</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Qty</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Price</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).map(item => (
                <tr key={item.id} className="border-b border-blue-200/50">
                  <td className="px-3 py-2">
                    <p className="text-slate-900">{(item.product as unknown as { name: string })?.name}</p>
                    {(item as any).note && <p className="text-xs text-slate-400 italic">* {(item as any).note}</p>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(item.unit_price)}</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>-{formatCurrency(sale.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Tax ({(TAX_RATE * 100).toFixed(0)}% GST)</span>
            <span>{formatCurrency(sale.tax_amount)}</span>
          </div>
          {surcharge > 0 && (
            <div className="flex justify-between text-yellow-700">
              <span>Surcharge</span><span>+{formatCurrency(surcharge)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-blue-200 pt-1.5">
            <span>Total</span><span className="text-blue-500">{formatCurrency(sale.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <button
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            <Printer size={14} /> Reprint
          </button>
          {canRefund && (sale.status === 'completed' || sale.status === 'partial_refund') && (
            <button
              onClick={() => setShowRefund(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-900/40 hover:bg-yellow-900/70 text-yellow-700 text-sm font-medium rounded-lg transition-colors"
            >
              <RotateCcw size={14} /> Refund Items
            </button>
          )}
          {canVoid && sale.status === 'completed' && (
            <button
              onClick={handleVoid}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-900/70 text-red-500 text-sm font-medium rounded-lg transition-colors"
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
          {surcharge > 0 && <div className="flex justify-between"><span>Surcharge</span><span>+{formatCurrency(surcharge)}</span></div>}
          <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatCurrency(sale.total)}</span></div>
          <p>{'='.repeat(36)}</p>
          <p className="text-center">Thank you!</p>
        </div>
      </div>
    </Modal>
  )
}