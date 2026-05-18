'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getLaybys, createLayby, makeLaybyPayment, cancelLayby } from '@/lib/services/laybys.service'
import { Layby, CartItem, Customer, PaymentMethod } from '@/types'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import CustomerSearch from '@/components/pos/CustomerSearch'
import { Plus, CreditCard, X } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-blue-900/50 text-blue-400',
  completed: 'bg-green-900/50 text-green-400',
  cancelled: 'bg-blue-100 text-slate-500',
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer']

export default function LaybysPage() {
  const { user } = useAuth()
  const [laybys, setLaybys] = useState<Layby[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active')

  // New layby wizard
  const [showNew, setShowNew] = useState(false)
  const [laybyCustomer, setLaybyCustomer] = useState<Customer | null>(null)
  const [laybyItems, setLaybyItems] = useState<{ name: string; qty: number; price: number }[]>([{ name: '', qty: 1, price: 0 }])
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('cash')
  const [laybyNotes, setLaybyNotes] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  // Payment on existing layby
  const [payingLayby, setPayingLayby] = useState<Layby | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [savingPay, setSavingPay] = useState(false)

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    setLaybys(await getLaybys(user.location_id))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleCreateLayby() {
    if (!laybyCustomer) { toast.error('Select a customer'); return }
    if (laybyItems.some(i => !i.name.trim() || i.qty <= 0 || i.price <= 0)) {
      toast.error('Fill in all item details'); return
    }
    setSavingNew(true)
    try {
      const cartItems: CartItem[] = laybyItems.map(i => ({
        product: { id: '', name: i.name, sku: null, barcode: null, category_id: null, price: i.price, cost: null, image_url: null, is_active: true, created_at: '' },
        quantity: i.qty,
        unit_price: i.price,
        discount_amount: 0,
        note: '',
      }))
      await createLayby(
        user!.location_id!,
        user!.id,
        laybyCustomer.id,
        cartItems,
        parseFloat(depositAmount) || 0,
        depositMethod,
        laybyNotes
      )
      toast.success('Layby created')
      setShowNew(false)
      setLaybyCustomer(null)
      setLaybyItems([{ name: '', qty: 1, price: 0 }])
      setDepositAmount('')
      setLaybyNotes('')
      load()
    } catch { toast.error('Failed to create layby') } finally { setSavingNew(false) }
  }

  async function handlePayment() {
    if (!payingLayby) return
    const amt = parseFloat(payAmount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter valid amount'); return }
    if (amt > payingLayby.balance_due) { toast.error('Amount exceeds balance'); return }
    setSavingPay(true)
    try {
      await makeLaybyPayment(payingLayby.id, amt, payMethod)
      toast.success('Payment recorded')
      setPayingLayby(null)
      setPayAmount('')
      load()
    } catch { toast.error('Failed to record payment') } finally { setSavingPay(false) }
  }

  async function handleCancel(layby: Layby) {
    if (!confirm('Cancel this layby?')) return
    try { await cancelLayby(layby.id); toast.success('Layby cancelled'); load() }
    catch { toast.error('Failed to cancel') }
  }

  const filtered = laybys.filter(l => filter ? l.status === filter : true)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laybys</h1>
          <p className="text-sm text-slate-500 mt-0.5">{laybys.filter(l => l.status === 'active').length} active</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus size={14} /> New Layby
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['active', 'completed', 'cancelled', ''].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filter === s ? 'bg-blue-600 text-white' : 'bg-blue-50 text-slate-500 hover:text-slate-800')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Paid</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Balance</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No laybys found</td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                <td className="px-4 py-3 text-slate-900 font-medium">
                  {(l.customer as unknown as { full_name: string })?.full_name}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(l.created_at)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(l.total)}</td>
                <td className="px-4 py-3 text-right text-green-400">{formatCurrency(l.deposit_paid)}</td>
                <td className="px-4 py-3 text-right font-bold text-red-400">{formatCurrency(l.balance_due)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[l.status])}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {l.status === 'active' && (
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setPayingLayby(l); setPayAmount(String(l.balance_due)) }}
                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
                        <CreditCard size={11} /> Pay
                      </button>
                      <button onClick={() => handleCancel(l)}
                        className="p-1 text-slate-400 hover:text-red-400"><X size={13} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Layby Modal */}
      {showNew && (
        <Modal title="New Layby" onClose={() => setShowNew(false)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Customer *</label>
              <CustomerSearch selected={laybyCustomer} onSelect={setLaybyCustomer} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-500">Items</label>
                <button onClick={() => setLaybyItems(prev => [...prev, { name: '', qty: 1, price: 0 }])}
                  className="text-xs text-blue-500 hover:text-blue-400">+ Add item</button>
              </div>
              <div className="space-y-2">
                {laybyItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={item.name} onChange={e => setLaybyItems(prev => { const u=[...prev]; u[i]={...u[i],name:e.target.value}; return u })}
                      placeholder="Item name"
                      className="flex-1 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="number" min={1} value={item.qty} onChange={e => setLaybyItems(prev => { const u=[...prev]; u[i]={...u[i],qty:parseInt(e.target.value)||1}; return u })}
                      className="w-14 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="number" min={0} step="0.01" value={item.price} onChange={e => setLaybyItems(prev => { const u=[...prev]; u[i]={...u[i],price:parseFloat(e.target.value)||0}; return u })}
                      placeholder="Price"
                      className="w-20 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    {laybyItems.length > 1 && (
                      <button onClick={() => setLaybyItems(prev => prev.filter((_,j)=>j!==i))} className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-right text-xs text-slate-400 mt-1">
                Total: {formatCurrency(laybyItems.reduce((s,i) => s + i.price * i.qty, 0))}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Deposit Amount</label>
                <input type="number" min={0} step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Payment Method</label>
                <select value={depositMethod} onChange={e => setDepositMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {METHODS.map(m => <option key={m} value={m} className="capitalize">{m.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Notes</label>
              <textarea value={laybyNotes} onChange={e => setLaybyNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handleCreateLayby} disabled={savingNew} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {savingNew ? 'Creating...' : 'Create Layby'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {payingLayby && (
        <Modal title="Record Payment" onClose={() => setPayingLayby(null)}>
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-slate-500">Customer: <span className="text-slate-900">{(payingLayby.customer as unknown as { full_name: string })?.full_name}</span></p>
              <p className="text-slate-500 mt-1">Balance Due: <span className="text-red-400 font-bold">{formatCurrency(payingLayby.balance_due)}</span></p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Amount</label>
              <input type="number" min={0} step="0.01" max={payingLayby.balance_due} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayingLayby(null)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handlePayment} disabled={savingPay} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {savingPay ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}