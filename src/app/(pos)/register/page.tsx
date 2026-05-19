'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getOpenRegister, openRegister, closeRegister, addCashMovement,
  getRegisterHistory, getRegisterSalesSummary,
} from '@/lib/services/register.service'
import { Register } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Lock, Unlock, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

const PAYMENT_METHODS = [
  { key: 'cash',           label: 'Cash' },
  { key: 'card',           label: 'Card (EFTPOS)' },
  { key: 'bank_transfer',  label: 'Bank Transfer' },
  { key: 'loyalty_points', label: 'Loyalty Points' },
  { key: 'account',        label: 'House Account' },
]

interface SalesSummary {
  tally: Record<string, number>
  totalSales: number
  totalDiscounts: number
  totalTax: number
  transactionCount: number
}

export default function RegisterPage() {
  const { user } = useAuth()
  const [openReg,  setOpenReg]  = useState<Register | null>(null)
  const [history,  setHistory]  = useState<Register[]>([])
  const [loading,  setLoading]  = useState(true)
  const [summary,  setSummary]  = useState<SalesSummary>({
    tally: {}, totalSales: 0, totalDiscounts: 0, totalTax: 0, transactionCount: 0,
  })

  // Open register form
  const [openingFloat, setOpeningFloat] = useState('')

  // Counted amounts per payment method (for the tally table)
  const [counted, setCounted] = useState<Record<string, string>>({})

  // Cash movement form
  const [showMovement,   setShowMovement]   = useState(false)
  const [movementType,   setMovementType]   = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    const [reg, hist] = await Promise.all([
      getOpenRegister(user.location_id, user.id),
      getRegisterHistory(user.location_id),
    ])
    setOpenReg(reg)
    setHistory(hist)

    if (reg) {
      const s = await getRegisterSalesSummary(user.location_id, reg.opened_at)
      setSummary(s)
      // Pre-fill Counted with Expected values so the cashier just adjusts if needed
      const init: Record<string, string> = {}
      for (const m of PAYMENT_METHODS) {
        const exp = m.key === 'cash'
          ? reg.opening_float + reg.cash_in - reg.cash_out + (s.tally.cash ?? 0)
          : (s.tally[m.key] ?? 0)
        init[m.key] = exp.toFixed(2)
      }
      setCounted(init)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpen() {
    if (!user?.location_id) return
    const f = parseFloat(openingFloat)
    if (isNaN(f) || f < 0) { toast.error('Enter a valid opening float'); return }
    try {
      await openRegister(user.location_id, user.id, f)
      setOpeningFloat('')
      toast.success('Register opened')
      load()
    } catch { toast.error('Failed to open register') }
  }

  async function handleClose() {
    if (!openReg) return
    const countedCash = parseFloat(counted.cash ?? '0')
    if (isNaN(countedCash) || countedCash < 0) { toast.error('Enter a valid cash amount'); return }
    try {
      await closeRegister(openReg.id, countedCash)
      setOpenReg(null)
      toast.success('Register closed')
      load()
    } catch { toast.error('Failed to close register') }
  }

  async function handleMovement() {
    if (!openReg) return
    const amt = parseFloat(movementAmount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    try {
      await addCashMovement(openReg.id, movementType, amt)
      setMovementAmount('')
      setShowMovement(false)
      toast.success(`Cash ${movementType} recorded`)
      load()
    } catch { toast.error('Failed to record movement') }
  }

  // Tally helpers
  function getExpected(key: string): number {
    if (!openReg) return 0
    if (key === 'cash') {
      return openReg.opening_float + openReg.cash_in - openReg.cash_out + (summary.tally.cash ?? 0)
    }
    return summary.tally[key] ?? 0
  }
  function getCounted(key: string) { return parseFloat(counted[key] ?? '0') || 0 }
  function getDifference(key: string) { return getCounted(key) - getExpected(key) }

  const totalExpected = PAYMENT_METHODS.reduce((s, m) => s + getExpected(m.key), 0)
  const totalCounted  = PAYMENT_METHODS.reduce((s, m) => s + getCounted(m.key), 0)
  const totalDiff     = totalCounted - totalExpected

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
  }

  return (
    <div className="space-y-5">

      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Register</h1>
        <p className="text-sm text-slate-500 mt-0.5">Open and close your cash register session</p>
      </div>

      {/* ══════════════════════ OPEN STATE ══════════════════════ */}
      {openReg ? (
        <>
          {/* Register status bar */}
          <div className="bg-white border border-blue-100 rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-slate-900">Cash Register</span>
              <span className="text-slate-400 text-sm">· {user?.location?.name ?? 'Store'}</span>
            </div>
            <div className="text-sm text-slate-500">
              <span className="text-slate-400">Opened:</span>{' '}
              <span className="text-slate-700 font-medium">{formatDateTime(openReg.opened_at)}</span>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

            {/* ── LEFT: Payment Tally ── */}
            <div className="lg:col-span-3 bg-white border border-blue-100 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-100">
                <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Payment Tally</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-100">
                      <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Payment Type</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Expected</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Counted</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYMENT_METHODS.map(m => {
                      const exp  = getExpected(m.key)
                      const diff = getDifference(m.key)
                      return (
                        <tr key={m.key} className="border-b border-blue-100/60 hover:bg-blue-50/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{m.label}</div>
                            {m.key === 'cash' && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                Net cash sales: {formatCurrency(summary.tally.cash ?? 0)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(exp)}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={counted[m.key] ?? ''}
                              onChange={e => setCounted(prev => ({ ...prev, [m.key]: e.target.value }))}
                              className="w-28 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-right text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            diff < 0 ? 'text-red-500' : diff > 0.005 ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Totals row */}
                    <tr className="bg-slate-50 font-semibold border-t border-blue-200">
                      <td className="px-5 py-3 text-slate-700">Total</td>
                      <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totalExpected)}</td>
                      <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totalCounted)}</td>
                      <td className={`px-4 py-3 text-right ${
                        totalDiff < 0 ? 'text-red-500' : totalDiff > 0.005 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action bar */}
              <div className="px-5 py-4 border-t border-blue-100 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setShowMovement(!showMovement)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    showMovement ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 hover:bg-blue-100 text-slate-600'
                  }`}
                >
                  <Plus size={13} /> Cash Movement
                </button>
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  <Lock size={14} /> Close Register
                </button>
              </div>

              {/* Cash movement form */}
              {showMovement && (
                <div className="mx-5 mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Record Cash Movement</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMovementType('in')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        movementType === 'in'
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-slate-500 border border-blue-200 hover:border-blue-300'
                      }`}
                    >
                      <Plus size={13} /> Cash In
                    </button>
                    <button
                      onClick={() => setMovementType('out')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        movementType === 'out'
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-slate-500 border border-blue-200 hover:border-blue-300'
                      }`}
                    >
                      <Minus size={13} /> Cash Out
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number" min={0} step="0.01"
                      value={movementAmount}
                      onChange={e => setMovementAmount(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleMovement}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Record
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Summaries ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Cash In / Out */}
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-blue-100 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Cash In / Out</h2>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                      +{formatCurrency(openReg.cash_in)}
                    </span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded">
                      -{formatCurrency(openReg.cash_out)}
                    </span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-100">
                      <th className="text-left px-4 py-2 text-slate-500 font-medium text-xs">Transaction</th>
                      <th className="text-right px-4 py-2 text-slate-500 font-medium text-xs">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-blue-100/50">
                      <td className="px-4 py-2.5 text-slate-700">Opening float</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(openReg.opening_float)}
                      </td>
                    </tr>
                    <tr className="border-b border-blue-100/50">
                      <td className="px-4 py-2.5 text-slate-500">Total cash in:</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                        {formatCurrency(openReg.cash_in)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-slate-500">Total cash out:</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-500">
                        {formatCurrency(openReg.cash_out)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Summary */}
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-blue-100">
                  <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Payment Summary</h2>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment received:</span>
                    <span className="font-medium text-slate-900">{formatCurrency(summary.totalSales)}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-100 pt-3">
                    <span className="text-slate-600 font-medium">Net receipts:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(summary.totalSales)}</span>
                  </div>
                </div>
              </div>

              {/* Sales Summary */}
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-blue-100">
                  <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Sales Summary</h2>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transactions:</span>
                    <span className="text-slate-900">{summary.transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total sales:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(summary.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Item discounts:</span>
                    <span className="text-slate-700">{formatCurrency(summary.totalDiscounts)}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-100 pt-3">
                    <span className="text-slate-500">Tax collected:</span>
                    <span className="text-slate-700">{formatCurrency(summary.totalTax)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (

        /* ══════════════════════ CLOSED STATE ══════════════════════ */
        <div className="bg-white border border-blue-100 rounded-xl p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <Lock size={20} className="text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Register Closed</h2>
          </div>
          <p className="text-sm text-slate-500 mb-5">Enter your opening float to start a register session.</p>
          <div className="flex gap-3">
            <input
              type="number" min={0} step="0.01"
              value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              placeholder="Opening float (e.g. 200.00)"
              className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleOpen}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <Unlock size={14} /> Open Register
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════ SESSION HISTORY ══════════════════════ */}
      {history.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Session History</h2>
          <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-100">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Opened</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Closed</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Float In</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Float Out</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(reg => (
                  <tr key={reg.id} className="border-b border-blue-200/50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-xs">{formatDateTime(reg.opened_at)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {reg.closed_at ? formatDateTime(reg.closed_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(reg.opening_float)}</td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {reg.closing_float != null ? formatCurrency(reg.closing_float) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        reg.status === 'open'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-blue-100 text-slate-500'
                      }`}>
                        {reg.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
