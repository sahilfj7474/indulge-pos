'use client'

import { useRef, useState, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { voidSale, updateSaleNotes } from '@/lib/services/sales.service'
import { getDefaultReceiptTemplate, ReceiptTemplate } from '@/lib/services/receipt-template.service'
import { getSettings } from '@/lib/services/settings.service'
import RefundModal from './RefundModal'
import { Printer, Ban, RotateCcw, X, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface Props {
  sale: Sale
  userId: string
  canVoid: boolean
  canRefund: boolean
  onClose: () => void
  onVoided: () => void
  onRefunded: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-100 text-green-600',
  voided:         'bg-red-100 text-red-500',
  refunded:       'bg-yellow-100 text-yellow-700',
  partial_refund: 'bg-orange-100 text-orange-600',
}

const METHOD_LABEL: Record<string, string> = {
  cash:           'Cash',
  card:           'Card (EFTPOS)',
  bank_transfer:  'Bank Transfer',
  loyalty_points: 'Loyalty Points',
  account:        'House Account',
  split:          'Split Payment',
}

export default function SaleDetailModal({
  sale, userId, canVoid, canRefund, onClose, onVoided, onRefunded,
  onPrev, onNext, hasPrev = false, hasNext = false,
}: Props) {
  const receiptRef  = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: receiptRef })
  const [showRefund,   setShowRefund]   = useState(false)
  const [notes,        setNotes]        = useState(sale.notes ?? '')
  const [savingNotes,  setSavingNotes]  = useState(false)
  const [template,     setTemplate]     = useState<ReceiptTemplate | null>(null)
  const [settings,     setPrintSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([getDefaultReceiptTemplate(), getSettings()]).then(([tmpl, s]) => {
      setTemplate(tmpl)
      setPrintSettings(s)
    })
  }, [])

  const surcharge      = (sale as any).surcharge_amount ?? 0
  const paymentDetails = (sale as any).payment_details
  const customerName   = (sale.customer as unknown as { full_name: string })?.full_name
  const cashierName    = (sale.user    as unknown as { full_name: string })?.full_name ?? '—'
  const locationName   = (sale.location as unknown as { name: string })?.name ?? '—'

  const splitPayments: { method: string; amount: number }[] =
    paymentDetails?.splits ?? []

  async function handleVoid() {
    if (!confirm('Void this sale? This cannot be undone.')) return
    try {
      await voidSale(sale.id)
      toast.success('Sale voided')
      onVoided()
      onClose()
    } catch { toast.error('Failed to void sale') }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      await updateSaleNotes(sale.id, notes)
      toast.success('Notes saved')
    } catch { toast.error('Failed to save notes') }
    finally { setSavingNotes(false) }
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
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-blue-950/50" onClick={onClose} />

      {/* Right-side drawer panel */}
      <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl overflow-hidden">

        {/* ── Top action bar ── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-blue-50 transition-colors"
            >
              <X size={18} />
            </button>
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 text-slate-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 text-slate-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 text-slate-600 hover:bg-blue-50 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
            {canRefund && (sale.status === 'completed' || sale.status === 'partial_refund') && (
              <button
                onClick={() => setShowRefund(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
              >
                <RotateCcw size={13} /> Refund
              </button>
            )}
            {canVoid && sale.status === 'completed' && (
              <button
                onClick={handleVoid}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
              >
                <Ban size={13} /> Void
              </button>
            )}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Sale header ── */}
          <div className="px-6 py-5 border-b border-blue-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-blue-600 uppercase tracking-wide">
                  {customerName ?? 'Walk In'}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                  <Receipt size={13} />
                  <span className="font-mono font-medium text-slate-700">
                    #{sale.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs font-medium',
                    STATUS_STYLES[sale.status] ?? 'bg-slate-100 text-slate-500'
                  )}>
                    {sale.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500 shrink-0">
                <p>Order date: <span className="text-slate-700">{formatDateTime(sale.created_at)}</span></p>
                <p className="mt-0.5">User: <span className="text-slate-700">{cashierName}</span></p>
                <p className="mt-0.5">Location: <span className="text-slate-700">{locationName}</span></p>
              </div>
            </div>
          </div>

          {/* ── Items ── */}
          <div className="px-6 py-4 border-b border-blue-100">
            <div className="space-y-3">
              {(sale.items ?? []).map((item, idx) => {
                const prod = item.product as unknown as { name: string; sku: string | null; image_url: string | null }
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    {/* Quantity badge */}
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {item.quantity}
                    </div>

                    {/* Product image */}
                    {prod?.image_url && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-blue-50 shrink-0">
                        <Image
                          src={prod.image_url}
                          alt={prod.name ?? ''}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}

                    {/* Name + SKU */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{prod?.name ?? `Item ${idx + 1}`}</p>
                      {prod?.sku && (
                        <p className="text-xs text-slate-400 mt-0.5">SKU: {prod.sku}</p>
                      )}
                      {(item as any).note && (
                        <p className="text-xs text-slate-400 italic mt-0.5">* {(item as any).note}</p>
                      )}
                      {item.discount_amount > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">Discount: -{formatCurrency(item.discount_amount)}</p>
                      )}
                    </div>

                    {/* Price info */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.total)}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-slate-400">{formatCurrency(item.unit_price)} ea</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-blue-100 space-y-2 text-sm">
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span className="text-green-600">-{formatCurrency(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{formatCurrency(sale.tax_amount)}</span>
              </div>
              {surcharge > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Surcharge</span>
                  <span>+{formatCurrency(surcharge)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 border-t border-blue-100 pt-2">
                <span>Total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Paid</span>
                <span className="font-medium text-slate-900">{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="px-6 py-4 border-b border-blue-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Notes</h3>
            <div className="flex gap-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes"
                rows={3}
                className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {notes !== (sale.notes ?? '') && (
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="self-end px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? '...' : 'Save'}
                </button>
              )}
            </div>
          </div>

          {/* ── Payment Summary ── */}
          <div className="px-6 py-4 border-b border-blue-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Payment Summary</h3>
            <div className="rounded-lg overflow-hidden border border-blue-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-100 bg-blue-50/50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Payment</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Date-Time</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">User</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {splitPayments.length > 0 ? (
                    splitPayments.map((sp, i) => (
                      <tr key={i} className={i < splitPayments.length - 1 ? 'border-b border-blue-100/60' : ''}>
                        <td className="px-4 py-2.5 text-slate-700 capitalize">
                          {METHOD_LABEL[sp.method] ?? sp.method.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{cashierName}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {formatCurrency(sp.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-2.5 text-slate-700">
                        {METHOD_LABEL[sale.payment_method] ?? sale.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{cashierName}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Sale History ── */}
          <div className="px-6 py-4 pb-8">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Sale History</h3>
            <div className="rounded-lg overflow-hidden border border-blue-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-100 bg-blue-50/50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Date-Time</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">User</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_STYLES[sale.status] ?? 'bg-slate-100 text-slate-500'
                      )}>
                        {sale.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{cashierName} ({locationName})</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden print area — uses receipt template */}
      <div className="hidden">
        <div ref={receiptRef} className="receipt-print bg-white text-black font-mono text-[11px] leading-snug mx-auto" style={{ width: '100%', maxWidth: 320 }}>

          {/* Header */}
          <div className="text-center mb-1">
            {(template == null || template.show_logo) && (
              <img src="/logo-black.png" alt="Indulge" className="h-12 w-auto mx-auto mb-1 object-contain" />
            )}
            <p className="font-bold text-sm tracking-wide">
              {(template?.trading_name || settings.store_name || locationName).toUpperCase()}
            </p>
            {(template?.show_address ?? true) && settings.business_address && <p>{settings.business_address}</p>}
            {(template?.show_phone   ?? true) && settings.business_phone   && <p>Tel: {settings.business_phone}</p>}
            {(template?.show_email   ?? true) && settings.business_email   && <p>{settings.business_email}</p>}
            {template?.header_text && <p className="italic mt-0.5">{template.header_text}</p>}
          </div>

          {/* Title */}
          <div className="border-0 border-t-2 border-black my-0.5 w-full" />
          <p className="text-center font-bold tracking-widest">
            {template?.receipt_type_label || 'TAX INVOICE/RECEIPT'}
          </p>
          <div className="border-0 border-t-2 border-black my-0.5 w-full" />

          {/* Meta */}
          <div className="space-y-0.5 my-1">
            <div className="flex justify-between"><span>Date:</span><span>{formatDateTime(sale.created_at)}</span></div>
            <div className="flex justify-between">
              <span>{template?.number_prefix ? `${template.number_prefix}:` : 'Receipt#:'}</span>
              <span>{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
            {(template?.show_sold_by ?? true) && (
              <div className="flex justify-between">
                <span>{template?.label_cashier || 'Served by'}:</span>
                <span>{cashierName}</span>
              </div>
            )}
            {customerName && (
              <div className="flex justify-between"><span>Customer:</span><span>{customerName}</span></div>
            )}
          </div>

          {/* Items header */}
          <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />
          <div className="flex justify-between font-bold my-0.5">
            <span>{template?.label_item  || 'Item'}</span>
            <span>{template?.label_price || 'Price'}</span>
          </div>
          <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />

          {/* Items */}
          <div className="space-y-1 my-1">
            {(sale.items ?? []).map(item => {
              const prod = item.product as unknown as { name: string }
              return (
                <div key={item.id}>
                  <p className="font-semibold truncate">{prod?.name}</p>
                  <div className="flex justify-between pl-2">
                    <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                  {item.discount_amount > 0 && (
                    <p className="pl-2">Disc: -{formatCurrency(item.discount_amount)}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />
          <div className="space-y-0.5 my-1">
            <div className="flex justify-between"><span>{template?.label_subtotal || 'Subtotal'}</span><span>{formatCurrency(sale.subtotal)}</span></div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between"><span>{template?.label_discount || 'Discount'}</span><span>-{formatCurrency(sale.discount_amount)}</span></div>
            )}
            <div className="flex justify-between"><span>{template?.label_tax || 'VAT'}</span><span>{formatCurrency(sale.tax_amount)}</span></div>
            {surcharge > 0 && (
              <div className="flex justify-between"><span>Surcharge</span><span>+{formatCurrency(surcharge)}</span></div>
            )}
          </div>
          <div className="border-0 border-t-2 border-black my-0.5 w-full" />
          <div className="flex justify-between font-bold text-sm my-1 tracking-wide">
            <span>{template?.label_total || 'TOTAL'}</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
          <div className="border-0 border-t-2 border-black my-0.5 w-full" />

          {/* Payment */}
          <div className="space-y-0.5 my-1">
            {splitPayments.length > 0 ? (
              <>
                <p className="font-semibold">SPLIT PAYMENT:</p>
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex justify-between pl-2">
                    <span>{sp.method.replace(/_/g, ' ').toUpperCase()}</span>
                    <span>{formatCurrency(sp.amount)}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex justify-between">
                <span>Payment Method</span>
                <span>{sale.payment_method.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />
          <div className="text-center my-1 space-y-0.5">
            <p className="font-bold">* {template?.footer_text || 'Thank you for your purchase!'} *</p>
            <p>Please visit us again!</p>
          </div>
          <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />
        </div>
      </div>
    </div>
  )
}
