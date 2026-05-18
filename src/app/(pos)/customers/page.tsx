'use client'

import { useState, useEffect, useMemo } from 'react'
import { Customer, Sale } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { getCustomerSales, adjustLoyaltyPoints } from '@/lib/services/customers.service'
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils'
import CustomerModal from '@/components/customers/CustomerModal'
import Modal from '@/components/ui/Modal'
import { Plus, Search, Star, Pencil, History, Gift, BookUser } from 'lucide-react'
import { getOrCreateAccount, recordAccountPayment, getAccountTransactions, CustomerAccount, AccountTransaction } from '@/lib/services/accounts.service'
import toast from 'react-hot-toast'

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-100 text-green-600',
  voided:         'bg-red-100 text-red-500',
  refunded:       'bg-yellow-100 text-yellow-700',
  partial_refund: 'bg-orange-900/50 text-orange-400',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  // Purchase history
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [historyData, setHistoryData] = useState<Sale[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Loyalty adjustment
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)
  const [loyaltyPoints, setLoyaltyPoints] = useState('')
  const [loyaltyNote, setLoyaltyNote] = useState('')
  const [savingLoyalty, setSavingLoyalty] = useState(false)

  // House account
  const [accountCustomer, setAccountCustomer] = useState<Customer | null>(null)
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [accountTxs, setAccountTxs] = useState<AccountTransaction[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('customers').select('*').order('full_name')
    setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openHistory(c: Customer) {
    setHistoryCustomer(c)
    setLoadingHistory(true)
    const sales = await getCustomerSales(c.id)
    setHistoryData(sales as Sale[])
    setLoadingHistory(false)
  }

  async function handleLoyaltyAdjust() {
    if (!loyaltyCustomer) return
    const pts = parseInt(loyaltyPoints)
    if (isNaN(pts) || pts === 0) { toast.error('Enter a non-zero point value (negative to deduct)'); return }
    if (!loyaltyNote.trim()) { toast.error('Note is required'); return }
    setSavingLoyalty(true)
    try {
      await adjustLoyaltyPoints(loyaltyCustomer.id, pts, loyaltyNote)
      toast.success(`${pts > 0 ? '+' : ''}${pts} points adjusted`)
      setLoyaltyCustomer(null)
      setLoyaltyPoints('')
      setLoyaltyNote('')
      load()
    } catch { toast.error('Failed to adjust points') } finally { setSavingLoyalty(false) }
  }

  async function openAccount(c: Customer) {
    setAccountCustomer(c)
    const [acct, txs] = await Promise.all([getOrCreateAccount(c.id), getAccountTransactions(c.id)])
    setAccount(acct)
    setAccountTxs(txs)
    setPaymentAmount('')
    setPaymentNote('')
  }

  async function handleAccountPayment() {
    if (!accountCustomer || !account) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return }
    if (amt > account.balance) { toast.error('Amount exceeds outstanding balance'); return }
    setSavingPayment(true)
    try {
      await recordAccountPayment(accountCustomer.id, amt, paymentNote || 'Payment received')
      toast.success('Payment recorded')
      await openAccount(accountCustomer)
    } catch { toast.error('Failed to record payment') } finally { setSavingPayment(false) }
  }

  const filtered = useMemo(() => {
    if (!search) return customers
    const q = search.toLowerCase()
    return customers.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    )
  }, [customers, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{customers.length} registered customers</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Customer
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Total Spent</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Points</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Member Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No customers found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-blue-200/50 hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-right text-slate-900 font-medium">{formatCurrency(c.total_spent)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('flex items-center justify-end gap-1', c.loyalty_points > 0 ? 'text-blue-500' : 'text-slate-400')}>
                    {c.loyalty_points > 0 && <Star size={11} />}
                    {c.loyalty_points}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button title="Purchase history" onClick={() => openHistory(c)}
                      className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-100 rounded transition-colors">
                      <History size={13} />
                    </button>
                    <button title="House account" onClick={() => openAccount(c)}
                      className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-100 rounded transition-colors">
                      <BookUser size={13} />
                    </button>
                    <button title="Adjust loyalty points" onClick={() => setLoyaltyCustomer(c)}
                      className="p-1.5 text-slate-500 hover:text-yellow-700 hover:bg-blue-100 rounded transition-colors">
                      <Gift size={13} />
                    </button>
                    <button onClick={() => { setEditing(c); setShowModal(true) }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer form modal */}
      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {/* Purchase History Modal */}
      {historyCustomer && (
        <Modal title={`${historyCustomer.full_name} — Purchase History`} onClose={() => setHistoryCustomer(null)} maxWidth="max-w-2xl">
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-slate-500">Total Spent</p>
                <p className="text-slate-900 font-bold">{formatCurrency(historyCustomer.total_spent)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-slate-500">Loyalty Points</p>
                <p className="text-blue-500 font-bold">{historyCustomer.loyalty_points} pts</p>
              </div>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : historyData.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No purchases yet</p>
            ) : (
              <div className="bg-blue-50 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-blue-50">
                    <tr className="border-b border-blue-200">
                      <th className="text-left px-3 py-2 text-slate-500">Date</th>
                      <th className="text-left px-3 py-2 text-slate-500">Receipt</th>
                      <th className="text-left px-3 py-2 text-slate-500">Location</th>
                      <th className="text-right px-3 py-2 text-slate-500">Total</th>
                      <th className="text-center px-3 py-2 text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((sale: any) => (
                      <tr key={sale.id} className="border-b border-blue-200/50">
                        <td className="px-3 py-2 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-blue-500 text-xs">{sale.id.slice(0,8).toUpperCase()}</td>
                        <td className="px-3 py-2 text-slate-500">{sale.location?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-900 font-medium">{formatCurrency(sale.total)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[sale.status] ?? '')}>
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* House Account Modal */}
      {accountCustomer && account && (
        <Modal title={`House Account — ${accountCustomer.full_name}`} onClose={() => setAccountCustomer(null)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Outstanding Balance</p>
                <p className={`text-xl font-bold ${account.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatCurrency(account.balance)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Credit Limit</p>
                <p className="text-xl font-bold text-slate-600">{formatCurrency(account.credit_limit)}</p>
              </div>
            </div>

            {account.balance > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-blue-300">Record a Payment</p>
                <div className="flex gap-2">
                  <input type="number" min="0.01" step="0.01" placeholder="Amount"
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Note (optional)"
                    value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleAccountPayment} disabled={savingPayment}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
                    {savingPayment ? '...' : 'Pay'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-blue-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-slate-500">Date</th>
                    <th className="text-left px-3 py-2 text-slate-500">Type</th>
                    <th className="text-right px-3 py-2 text-slate-500">Amount</th>
                    <th className="text-left px-3 py-2 text-slate-500">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {accountTxs.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-slate-400">No transactions yet</td></tr>
                  ) : accountTxs.map(tx => (
                    <tr key={tx.id} className="border-t border-blue-200/50">
                      <td className="px-3 py-2 text-slate-500">{formatDate(tx.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={tx.type === 'charge' ? 'text-red-500' : 'text-green-600'}>
                          {tx.type === 'charge' ? 'Charge' : 'Payment'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(tx.amount)}</td>
                      <td className="px-3 py-2 text-slate-500">{tx.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Loyalty Adjustment Modal */}
      {loyaltyCustomer && (
        <Modal title={`Adjust Loyalty — ${loyaltyCustomer.full_name}`} onClose={() => setLoyaltyCustomer(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Current balance: <span className="text-blue-500 font-bold">{loyaltyCustomer.loyalty_points} points</span>
            </p>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Points to Add / Deduct</label>
              <input type="number" value={loyaltyPoints} onChange={e => setLoyaltyPoints(e.target.value)}
                placeholder="e.g. 50 or -20"
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-slate-400 mt-1">Use negative value to deduct points</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Reason *</label>
              <input type="text" value={loyaltyNote} onChange={e => setLoyaltyNote(e.target.value)}
                placeholder="e.g. Promotion, Correction"
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLoyaltyCustomer(null)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handleLoyaltyAdjust} disabled={savingLoyalty} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {savingLoyalty ? 'Saving...' : 'Adjust Points'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}