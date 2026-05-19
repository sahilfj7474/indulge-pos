'use client'

import { useState } from 'react'
import { SplitPayment } from '@/lib/services/pos.service'
import { PaymentMethodConfig, DEFAULT_PAYMENT_METHODS } from '@/lib/services/settings.service'
import { formatCurrency, cn } from '@/lib/utils'
import {
  X, Banknote, CreditCard, Building2, Star, Split, BookUser, Smartphone,
} from 'lucide-react'

interface Props {
  total: number
  loyaltyPointsRedeemed: number
  hasCustomer?: boolean
  paymentMethods?: PaymentMethodConfig[]
  onConfirm: (method: string, amountTendered: number, splits?: SplitPayment[], surchargeAmt?: number) => void
  onClose: () => void
}

function getIcon(id: string) {
  if (id === 'cash')                                              return Banknote
  if (id === 'card' || id === 'eftpos')                          return CreditCard
  if (id === 'bank_transfer' || id === 'bank')                   return Building2
  if (id === 'loyalty_points' || id === 'loyalty')               return Star
  if (id === 'account')                                          return BookUser
  if (['mpaisa', 'mobile', 'phone', 'mpay'].some(k => id.includes(k))) return Smartphone
  return CreditCard
}

export default function PaymentModal({
  total,
  loyaltyPointsRedeemed,
  hasCustomer = false,
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  onConfirm,
  onClose,
}: Props) {
  const enabledMethods = paymentMethods.filter(m => m.enabled)

  const [isSplit, setIsSplit] = useState(false)
  const [method, setMethod] = useState<string>(enabledMethods[0]?.id ?? 'cash')
  const [tendered, setTendered] = useState('')

  // Split
  const splitCandidates = enabledMethods.filter(m => !m.requires_customer)
  const [split1Method, setSplit1Method] = useState<string>(splitCandidates[0]?.id ?? 'cash')
  const [split2Method, setSplit2Method] = useState<string>(splitCandidates[1]?.id ?? 'card')
  const [split1Amount, setSplit1Amount] = useState('')

  const split1 = parseFloat(split1Amount || '0')
  const split2 = Math.max(0, total - split1)
  const splitValid = split1 > 0 && split1 < total && split1Method !== split2Method

  // Per-method surcharge (single payment only)
  const selectedMethod = enabledMethods.find(m => m.id === method)
  const surchargeAmt = !isSplit && (selectedMethod?.surcharge_pct ?? 0) > 0
    ? +(total * (selectedMethod!.surcharge_pct / 100)).toFixed(2)
    : 0
  const finalTotal = total + surchargeAmt

  const change = !isSplit && method === 'cash'
    ? Math.max(0, parseFloat(tendered || '0') - finalTotal)
    : 0

  const singleCanComplete = isSplit
    ? splitValid
    : selectedMethod?.requires_customer
      ? hasCustomer
      : method !== 'cash' || parseFloat(tendered || '0') >= finalTotal

  function handleConfirm() {
    if (isSplit) {
      const splits: SplitPayment[] = [
        { method: split1Method, amount: split1 },
        { method: split2Method, amount: split2 },
      ]
      onConfirm('split', total, splits, 0)
    } else {
      onConfirm(method, parseFloat(tendered || String(finalTotal)), undefined, surchargeAmt)
    }
  }

  return (
    <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
          <h2 className="text-lg font-semibold text-slate-900">Payment</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount due */}
          <div className="text-center">
            <p className="text-sm text-slate-500">Amount Due</p>
            <p className="text-3xl font-bold text-blue-500">{formatCurrency(finalTotal)}</p>
            {surchargeAmt > 0 && (
              <p className="text-xs text-amber-600 mt-0.5 font-medium">
                Incl. {selectedMethod!.surcharge_pct}% surcharge (+{formatCurrency(surchargeAmt)})
              </p>
            )}
            {loyaltyPointsRedeemed > 0 && (
              <p className="text-xs text-blue-400 mt-0.5">Includes {loyaltyPointsRedeemed} pts redeemed</p>
            )}
          </div>

          {/* Single / Split toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setIsSplit(false)}
              className={cn('flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                !isSplit ? 'bg-blue-600 text-white' : 'bg-blue-50 text-slate-500 hover:text-slate-800')}
            >
              Single
            </button>
            <button
              onClick={() => setIsSplit(true)}
              className={cn('flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isSplit ? 'bg-blue-600 text-white' : 'bg-blue-50 text-slate-500 hover:text-slate-800')}
            >
              <Split size={14} /> Split
            </button>
          </div>

          {!isSplit ? (
            <>
              {/* Method grid */}
              <div className="grid grid-cols-2 gap-2">
                {enabledMethods.map(m => {
                  const Icon = getIcon(m.id)
                  const disabled = !!m.requires_customer && !hasCustomer
                  return (
                    <button
                      key={m.id}
                      onClick={() => !disabled && setMethod(m.id)}
                      disabled={disabled}
                      title={disabled ? 'Select a customer first' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-3.5 rounded-xl border text-sm font-semibold transition-colors active:scale-[0.97]',
                        method === m.id
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : disabled
                            ? 'bg-blue-50/40 border-blue-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-50 border-blue-200 text-slate-500 hover:text-slate-800 hover:border-blue-300'
                      )}
                    >
                      <Icon size={17} />
                      <span className="truncate">{m.label}</span>
                      {m.surcharge_pct > 0 && method !== m.id && (
                        <span className="ml-auto text-xs text-amber-500 font-normal shrink-0">+{m.surcharge_pct}%</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {selectedMethod?.requires_customer && !hasCustomer && (
                <p className="text-xs text-amber-600">Add a customer to the cart to use this payment method.</p>
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
                    className="w-full px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-xl text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={finalTotal.toFixed(2)}
                  />
                  {parseFloat(tendered || '0') >= finalTotal && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-slate-500">Change</span>
                      <span className="text-green-600 font-semibold">{formatCurrency(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedMethod?.requires_customer && hasCustomer && (
                <div className="p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg text-xs text-blue-300">
                  {formatCurrency(total)} will be added to the customer&apos;s outstanding account balance.
                </div>
              )}
            </>
          ) : (
            /* Split payment */
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment 1</label>
                <div className="flex gap-2">
                  <select
                    value={split1Method}
                    onChange={e => setSplit1Method(e.target.value)}
                    className="flex-1 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {splitCandidates.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
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
                    onChange={e => setSplit2Method(e.target.value)}
                    className="flex-1 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {splitCandidates.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
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
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white text-base font-bold rounded-xl transition-colors"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}
