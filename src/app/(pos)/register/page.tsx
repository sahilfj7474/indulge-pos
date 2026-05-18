'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getOpenRegister, openRegister, closeRegister, addCashMovement, getRegisterHistory
} from '@/lib/services/register.service'
import { Register } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Lock, Unlock, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { user } = useAuth()
  const [openReg, setOpenReg] = useState<Register | null>(null)
  const [history, setHistory] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)

  // Open form
  const [openingFloat, setOpeningFloat] = useState('')

  // Close form
  const [closingFloat, setClosingFloat] = useState('')

  // Cash movement
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [showMovement, setShowMovement] = useState(false)

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    const [reg, hist] = await Promise.all([
      getOpenRegister(user.location_id, user.id),
      getRegisterHistory(user.location_id),
    ])
    setOpenReg(reg)
    setHistory(hist)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleOpen() {
    if (!user?.location_id) return
    const f = parseFloat(openingFloat)
    if (isNaN(f) || f < 0) { toast.error('Enter a valid opening float'); return }
    try {
      const reg = await openRegister(user.location_id, user.id, f)
      setOpenReg(reg)
      setOpeningFloat('')
      toast.success('Register opened')
      load()
    } catch { toast.error('Failed to open register') }
  }

  async function handleClose() {
    if (!openReg) return
    const f = parseFloat(closingFloat)
    if (isNaN(f) || f < 0) { toast.error('Enter a valid closing float'); return }
    try {
      await closeRegister(openReg.id, f)
      setOpenReg(null)
      setClosingFloat('')
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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Register</h1>
        <p className="text-sm text-gray-400 mt-0.5">Open and close your cash register session</p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border p-6 ${openReg ? 'bg-green-900/20 border-green-700/40' : 'bg-gray-900 border-gray-800'}`}>
        <div className="flex items-center gap-3 mb-4">
          {openReg ? (
            <Unlock size={20} className="text-green-400" />
          ) : (
            <Lock size={20} className="text-gray-400" />
          )}
          <h2 className="text-lg font-semibold text-white">
            {openReg ? 'Register Open' : 'Register Closed'}
          </h2>
        </div>

        {openReg ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Opened</p>
                <p className="text-white">{formatDateTime(openReg.opened_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Opening Float</p>
                <p className="text-white font-bold">{formatCurrency(openReg.opening_float)}</p>
              </div>
              <div>
                <p className="text-gray-400">Cash In / Out</p>
                <p className="text-green-400">+{formatCurrency(openReg.cash_in)}</p>
                <p className="text-red-400">-{formatCurrency(openReg.cash_out)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMovement(!showMovement)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                <ArrowDownCircle size={14} /> Cash Movement
              </button>
            </div>

            {showMovement && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMovementType('in')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${movementType === 'in' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    <ArrowDownCircle size={13} /> Cash In
                  </button>
                  <button
                    onClick={() => setMovementType('out')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${movementType === 'out' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    <ArrowUpCircle size={13} /> Cash Out
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={movementAmount}
                    onChange={e => setMovementAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={handleMovement}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                    Record
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-700 pt-4">
              <label className="block text-sm text-gray-400 mb-2">Closing Float (counted cash)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={closingFloat}
                  onChange={e => setClosingFloat(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  <Lock size={14} /> Close Register
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Enter your opening float to start a register session.</p>
            <div className="flex gap-3">
              <input
                type="number"
                min={0}
                step="0.01"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
                placeholder="Opening float (e.g. 200.00)"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-bold rounded-lg transition-colors"
              >
                <Unlock size={14} /> Open Register
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Session History</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Opened</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Closed</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Float In</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Float Out</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(reg => (
                  <tr key={reg.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-gray-300 text-xs">{formatDateTime(reg.opened_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{reg.closed_at ? formatDateTime(reg.closed_at) : '—'}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(reg.opening_float)}</td>
                    <td className="px-4 py-3 text-right text-white">{reg.closing_float != null ? formatCurrency(reg.closing_float) : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reg.status === 'open' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
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
