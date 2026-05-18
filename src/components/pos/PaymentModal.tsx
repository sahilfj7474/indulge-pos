'use client'

import { useState } from 'react'
import { PaymentMethod } from '@/types'
import { SplitPayment } from '@/lib/services/pos.service'
import { formatCurrency, cn } from '@/lib/utils'
import { X, Banknote, CreditCard, Building2, Star, Split, BookUser } from 'lucide-react'

interface Props {
  total: number
  loyaltyPointsRedeemed: number
  hasCustomer?: boolean
  onConfirm: (method: PaymentMethod, amountTendered: number, splits?: SplitPayment[]) => void
  onClose: () => void
}

type SingleMethod = Exclude<PaymentMethod, 'split'>

const ALL_METHODS: { value: SingleMethod; label: string; icon: React.ElementType; requiresCustomer?: boolean }[] = [
  { value: 'cash',           label: 'Cash',           icon: Banknote   },
  { value: 'card',           label: 'Card / EFTPOS',  icon: CreditCard },
  { value: 'bank_transfer',  label: 'Bank Transfer',  icon: Building2  },
  { value: 'loyalty_points', label: 'Loyalty Points', icon: Star       },
  { value: 'account',        label: 'Charge to Acct', icon: BookUser, requiresCustomer: true },
]

export default function PaymentModal({ total, loyaltyPointsRedeemed, hasCustomer = false, onConfirm, onClose }: Props) {
  const [isSplit, setIsSplit] = useState(false)

  // Single payment
  const [method, setMethod] = useState<SingleMethod>('cash')
  const [tendered, setTendered] = useState('')

  // Split payment
  const [split1Method, setSplit1Method] = useState<SingleMethod>('cash')
  const [split1Amount, setSplit1Amount] = useState('')
  const [split2Method, setSplit2Method] = useState<SingleMethod>('card')

  const split1 = parseFloat(split1Amount || '0')
  const split2 = Math.max(0, total - split1)
  const splitValid = split1 > 0 && split1 < total && split1Method !== split2Method

  const change = !isSplit && method === 'cash' ? Math.max(0, parseFloat(tendered || '0') - total) : 0
  const singleCanComplete = isSplit
    ? splitValid
    : method === 'account'
      ? hasCustomer
      : method !== 'cash' || parseFloat(tendered || '0') >= total

  function handleConfirm() {
    if (isSplit) {
      const splits: SplitPayment[] = [
        { method: split1Method, amount: split1 },
        { method: split2Method, amount: split2 },
      ]
      onConfirm('split', total, splits)
    } else {
      onConfirm(method, parseFloat(tendered || String(total)))
    }
  }

  const splitMethods = ALL_METHODS.filter(m => m.value !== 'account')

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
              <p className="text-xs text-indigo-300 mt-0.5">Includes {loyaltyPointsRedeemed} pts redeemed</p>
            )}
          </div>

          {/* Split toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setIsSplit(false)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                !isSplit ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}
            >
              Single
            </button>
            <button
              onClick={() => setIsSplit(true)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isSplit ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}
            >
              <Split size={12} /> Split
            </button>
          </div>

          {!isSplit ? (
            <>
              {/* Single method grid */}
              <div className="grid grid-cols-2 gap-2">
                {ALL_METHODS.map(m => {
                  const Icon = m.icon
                  const disabled = m.requiresCustomer && !hasCustomer
                  return (
                    <button
                      key={m.value}
                      onClick={() => !disabled && setMethod(m.value)}
                      disabled={disabled}
                      title={disabled ? 'Select a customer first' : undefined}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                        method === m.value
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : disabled
                            ? 'bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                      )}
                    >
                      <Icon size={15} />{m.label}
                    </button>
                  )
                })}
              </div>

              {method === 'account' && !hasCustomer && (
                <p className="text-xs text-amber-400">Add a customer to the cart to charge to account.</p>
              )}

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

              {method === 'account' && hasCustomer && (
                <div className="p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg text-xs text-blue-300">
                  {formatCurrency(total)} will be added to the customer's outstanding account balance.
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment 1</label>
                <div className="flex gap-2">
                  <select
                    value={split1Method}
                    onChange={e => setSplit1Method(e.target.value as SingleMethod)}
                    className="flex-1 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {splitMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input
                    type="number"
                    value={split1Amount}
                    onChange={e => setSplit1Amount(e.target.value)}
                    placeholder="Amount"
                    className="w-24 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment 2 (remaining)</label>
                <div className="flex gap-2">
                  <select
                    value={split2Method}
                    onChange={e => setSplit2Method(e.target.value as SingleMethod)}
                    className="flex-1 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {splitMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <div className="w-24 px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white text-right">
                    {formatCurrency(split2)}
                  </div>
                </div>
              </div>
              {split1Method === split2Method && split1 > 0 && (
                <p className="text-xs text-red-400">Select different methods for each payment.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!singleCanComplete}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}
