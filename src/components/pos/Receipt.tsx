'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale, CartItem, Customer, Location, User } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { X, Printer } from 'lucide-react'
import { TAX_RATE } from './Cart'

interface Props {
  sale: Sale
  items: CartItem[]
  customer: Customer | null
  location: Location
  cashier: User
  amountTendered: number
  loyaltyPointsRedeemed: number
  loyaltyPointsEarned: number
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
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  const change = sale.payment_method === 'cash'
    ? Math.max(0, amountTendered - sale.total)
    : 0

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Printer size={14} />
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable receipt preview */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div ref={ref} className="receipt-print bg-white text-black p-4 font-mono text-xs">
            {/* Store header */}
            <div className="text-center mb-3">
              <p className="text-base font-bold">{location.name}</p>
              {location.address && <p>{location.address}</p>}
              {location.phone && <p>Tel: {location.phone}</p>}
              <p className="mt-1 text-gray-500">{'='.repeat(36)}</p>
            </div>

            {/* Sale info */}
            <p>{formatDateTime(sale.created_at)}</p>
            <p>Receipt: {sale.id.slice(0, 8).toUpperCase()}</p>
            <p>Cashier: {cashier.full_name}</p>
            {customer && <p>Customer: {customer.full_name}</p>}

            <p className="my-2">{'='.repeat(36)}</p>

            {/* Items */}
            <div className="space-y-1">
              {items.map((item, i) => {
                const lineTotal = (item.unit_price * item.quantity) - item.discount_amount
                return (
                  <div key={i}>
                    <p className="truncate">{item.product.name}</p>
                    <div className="flex justify-between pl-2">
                      <span>{item.quantity} x {formatCurrency(item.unit_price)}</span>
                      <span>{formatCurrency(lineTotal)}</span>
                    </div>
                    {item.discount_amount > 0 && (
                      <p className="pl-2 text-gray-500">Disc: -{formatCurrency(item.discount_amount)}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="my-2">{'='.repeat(36)}</p>

            {/* Totals */}
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatCurrency(sale.discount_amount)}</span>
                </div>
              )}
              {loyaltyPointsRedeemed > 0 && (
                <div className="flex justify-between">
                  <span>Points Redeemed</span>
                  <span>-{formatCurrency(loyaltyPointsRedeemed)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax ({(TAX_RATE * 100).toFixed(0)}% GST)</span>
                <span>{formatCurrency(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            <p className="my-2">{'='.repeat(36)}</p>

            {/* Payment */}
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize">{sale.payment_method.replace('_', ' ')}</span>
              </div>
              {sale.payment_method === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered</span>
                    <span>{formatCurrency(amountTendered)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Loyalty */}
            {customer && (
              <>
                <p className="my-2">{'='.repeat(36)}</p>
                <div className="space-y-0.5">
                  {loyaltyPointsEarned > 0 && (
                    <p>Points Earned: +{loyaltyPointsEarned}</p>
                  )}
                  <p>Points Balance: {(customer.loyalty_points + loyaltyPointsEarned - loyaltyPointsRedeemed)}</p>
                </div>
              </>
            )}

            {/* Footer */}
            <p className="my-2">{'='.repeat(36)}</p>
            <p className="text-center">Thank you for your purchase!</p>
            <p className="text-center">Please come again.</p>
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
