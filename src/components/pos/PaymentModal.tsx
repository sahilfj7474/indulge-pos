'use client'

import { useState } from 'react'
import { PaymentMethod } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { X, Banknote, CreditCard, Building2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  total: number
  loyaltyPointsRedeemed: number
  onConfirm: (method: PaymentMethod, amountTendered: number) => void
  onClose: () => void
}

const METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'cash',          label: 'Cash',          icon: Banknote },
  { value: 'card',          label: 'Card / EFTPOS',  icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank Transfer',  icon: Building2 },
  { value: 'loyalty_points',label: 'Loyalty Points', icon: Star },
]

export default function PaymentModal({ total, loyaltyPointsRedeemed, onConfirm, onClose }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')

  const change = method === 'cash' ? Math.max(0, parseFloat(tendered || '0') - total) : 0
  const canComplete =
    method !== 'cash' || parseFloat(tendered || '0') >= total

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Total */}
          <div className="text-center">
            <p className="text-sm text-gray-400">Amount Due</p>
            <p className="text-3xl font-bold text-indigo-400">{formatCurrency(total)}</p>
            {loyaltyPointsRedeemed > 0 && (
              <p className="text-xs text-indigo-300 mt-0.5">
                Includes {loyaltyPointsRedeemed} pts redeemed
              </p>
            )}
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    method === m.value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  )}
                >
                  <Icon size={15} />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Cash tendered */}
          {method === 'cash' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount Tendered</label>
              <input
                type="number"
                autoFocus
                value={tendered}
                onChange={e => setTendered(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
              {parseFloat(tendered || '0') >= total && (
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-gray-400">Change</span>
                  <span className="text-green-400 font-semibold">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => onConfirm(method, parseFloat(tendered || String(total)))}
            disabled={!canComplete}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}
