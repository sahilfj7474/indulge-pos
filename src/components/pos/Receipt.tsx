'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale, CartItem, Customer, Location, User } from '@/types'
import { SplitPayment } from '@/lib/services/pos.service'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { X, Printer } from 'lucide-react'

interface Props {
  sale: Sale
  items: CartItem[]
  customer: Customer | null
  location: Location
  cashier: User
  amountTendered: number
  loyaltyPointsRedeemed: number
  loyaltyPointsEarned: number
  splitPayments?: SplitPayment[]
  settings?: Record<string, string>
  taxRate?: number
  taxInclusive?: boolean
  onClose: () => void
}

export default function Receipt({
  sale,
  items,
  customer,
  location,
  cashier,
  amountTendered,
  loyaltyPointsRedeemed,
  loyaltyPointsEarned,
  splitPayments,
  settings = {},
  taxRate = 0.09,
  taxInclusive = false,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  const change = sale.payment_method === 'cash'
    ? Math.max(0, amountTendered - sale.total)
    : 0

  const surcharge = (sale as any).surcharge_amount ?? 0

  const storeName = settings.store_name || location.name
  const businessAddress = settings.business_address || location.address || ''
  const businessPhone = settings.business_phone || location.phone || ''
  const businessEmail = settings.business_email || ''
  const vatNumber = settings.vat_number || ''
  const receiptHeader = settings.receipt_header || ''
  const receiptFooter = settings.receipt_footer || 'Thank you for your purchase!'
  const taxLabel = `${(taxRate * 100).toFixed(0)}% VAT${taxInclusive ? ' (incl.)' : ''}`

  return (
    <div className="fixed inset-0 bg-blue-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
          <h2 className="text-lg font-semibold text-slate-900">Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div ref={ref} className="receipt-print bg-white text-black p-4 font-mono text-xs">
            <div className="text-center mb-3">
              <p className="text-base font-bold">{storeName}</p>
              {businessAddress && <p>{businessAddress}</p>}
              {businessPhone && <p>Tel: {businessPhone}</p>}
              {businessEmail && <p>{businessEmail}</p>}
              {vatNumber && <p>VAT Reg: {vatNumber}</p>}
              {receiptHeader && <p className="mt-1 italic">{receiptHeader}</p>}
              <p className="mt-1">{'='.repeat(36)}</p>
            </div>

            <p>{formatDateTime(sale.created_at)}</p>
            <p>Receipt: {sale.id.slice(0, 8).toUpperCase()}</p>
            <p>Cashier: {cashier.full_name}</p>
            {customer && <p>Customer: {customer.full_name}</p>}
            <p className="my-2">{'='.repeat(36)}</p>

            <div className="space-y-1">
              {items.map((item, i) => {
                const lineTotal = item.unit_price * item.quantity - item.discount_amount
                return (
                  <div key={i}>
                    <p className="truncate">{item.product.name}</p>
                    <div className="flex justify-between pl-2">
                      <span>{item.quantity} x {formatCurrency(item.unit_price)}</span>
                      <span>{formatCurrency(lineTotal)}</span>
                    </div>
                    {item.discount_amount > 0 && (
                      <p className="pl-2 text-slate-400">Disc: -{formatCurrency(item.discount_amount)}</p>
                    )}
                    {item.note && <p className="pl-2 text-slate-400 italic">* {item.note}</p>}
                  </div>
                )
              })}
            </div>

            <p className="my-2">{'='.repeat(36)}</p>

            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(sale.discount_amount)}</span></div>
              )}
              {loyaltyPointsRedeemed > 0 && (
                <div className="flex justify-between"><span>Points Redeemed</span><span>-{formatCurrency(loyaltyPointsRedeemed)}</span></div>
              )}
              <div className="flex justify-between">
                <span>{taxLabel}</span>
                <span>{formatCurrency(sale.tax_amount)}</span>
              </div>
              {surcharge > 0 && (
                <div className="flex justify-between"><span>Surcharge</span><span>+{formatCurrency(surcharge)}</span></div>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span><span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            <p className="my-2">{'='.repeat(36)}</p>

            <div className="space-y-0.5">
              {splitPayments && splitPayments.length > 0 ? (
                splitPayments.map((sp, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="capitalize">{sp.method.replace('_', ' ')}</span>
                    <span>{formatCurrency(sp.amount)}</span>
                  </div>
                ))
              ) : sale.payment_method === 'account' ? (
                <div className="flex justify-between">
                  <span>Charged to Account</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <span className="capitalize">{sale.payment_method.replace('_', ' ')}</span>
                  </div>
                  {sale.payment_method === 'cash' && (
                    <>
                      <div className="flex justify-between"><span>Tendered</span><span>{formatCurrency(amountTendered)}</span></div>
                      <div className="flex justify-between"><span>Change</span><span>{formatCurrency(change)}</span></div>
                    </>
                  )}
                </>
              )}
            </div>

            {customer && (
              <>
                <p className="my-2">{'='.repeat(36)}</p>
                <div className="space-y-0.5">
                  {loyaltyPointsEarned > 0 && <p>Points Earned: +{loyaltyPointsEarned}</p>}
                  <p>Points Balance: {customer.loyalty_points + loyaltyPointsEarned - loyaltyPointsRedeemed}</p>
                </div>
              </>
            )}

            <p className="my-2">{'='.repeat(36)}</p>
            <p className="text-center">{receiptFooter}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .receipt-print { display: block !important; }
        }
      `}</style>
    </div>
  )
}