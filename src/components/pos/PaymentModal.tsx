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
    <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
          <h2 className="text-lg font-semibold text-slate-900">Payment</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Total */}
          <div className="text-center">
            <p className="text-sm text-slate-500">Amount Due</p>
            <p className="text-3xl font-bold text-blue-500">{formatCurrency(total)}</p>
            {loyaltyPointsRedeemed > 0 && (
              <p className="text-xs text-blue-400 mt-0.5">Includes {loyaltyPointsRedeemed} pts redeemed</p>
            )}
          </div>

          {/* Split toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setIsSplit(false)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                !isSplit ? 'bg-blue-600 text-white' : 'bg-blue-50 text-slate-500 hover:text-slate-800')}
            >
              Single
            </button>
            <button
              onClick={() => setIsSplit(true)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isSplit ? 'bg-blue-600 text-white' : 'bg-blue-50 text-slate-500 hover:text-slate-800')}
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
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : disabled
                            ? 'bg-blue-50/40 border-blue-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-50 border-blue-200 text-slate-500 hover:text-slate-800 hover:border-blue-300'
                      )}
                    >
                      <Icon size={15} />{m.label}
                    </button>
                  )
                })}
              </div>

              {method === 'account' && !hasCustomer && (
                <p className="text-xs text-amber-600">Add a customer to the cart to charge to account.</p>
              )}

              {/* Cash tendered */}
              {method === 'cash' && (
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Amount Tendered</label>
                  <input
                    type="number"
                    autoFocus
                    value={tendered}
                    onChange={e => setTendered(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  {parseFloat(tendered || '0') >= total && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-slate-500">Change</span>
                      <span className="text-green-600 font-semibold">{formatCurrency(change)}</span>
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
                <label className="block text-xs text-slate-500 mb-1">Payment 1</label>
                <div className="flex gap-2">
                  <select
                    value={split1Method}
                    onChange={e => setSplit1Method(e.target.value as SingleMethod)}
                    className="flex-1 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {splitMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input
                    type="number"
                    value={split1Amount}
                    onChange={e => setSplit1Amount(e.target.value)}
                    placeholder="Amount"
                    className="w-24 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment 2 (remaining)</label>
                <div className="flex gap-2">
                  <select
                    value={split2Method}
                    onChange={e => setSplit2Method(e.target.value as SingleMethod)}
                    className="flex-1 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {splitMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <div className="w-24 px-2 py-2 bg-blue-100 border border-blue-300 rounded-lg text-sm text-slate-900 text-right">
                    {formatCurrency(split2)}
                  </div>
                </div>
              </div>
              {split1Method === split2Method && split1 > 0 && (
                <p className="text-xs text-red-500">Select different methods for each payment.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!singleCanComplete}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}