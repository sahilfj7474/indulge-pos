'use client'

import { useState, useEffect, useMemo } from 'react'
import { Customer, Sale } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { getCustomerSales, adjustLoyaltyPoints } from '@/lib/services/customers.service'
import {
  getOrCreateAccount as getAcct,
  recordAccountPayment as payAcct,
  getAccountTransactions as getAcctTxs,
  CustomerAccount, AccountTransaction,
} from '@/lib/services/accounts.service'
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils'
import CustomerModal from '@/components/customers/CustomerModal'
import Modal from '@/components/ui/Modal'
import { Plus, Search, Star, Pencil, Gift, BookUser, X, Phone, Mail, MapPin, Building2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-100 text-green-700',
  voided:         'bg-red-100 text-red-500',
  refunded:       'bg-yellow-100 text-yellow-700',
  partial_refund: 'bg-orange-100 text-orange-600',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  // Detail panel
  const [detail, setDetail] = useState<Customer | null>(null)
  const [detailSales, setDetailSales] = useState<any[]>([])
  const [detailSalesLoading, setDetailSalesLoading] = useState(false)

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
    const { data } = await supabase
      .from('customers')
      .select('*, customer_group:customer_groups(id,name,discount_type,discount_value,is_default,created_at)')
      .order('full_name')
    setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openDetail(c: Customer) {
    setDetail(c)
    setDetailSalesLoading(true)
    const sales = await getCustomerSales(c.id)
    setDetailSales(sales)
    setDetailSalesLoading(false)
  }

  async function handleLoyaltyAdjust() {
    if (!loyaltyCustomer) return
    const pts = parseInt(loyaltyPoints)
    if (isNaN(pts) || pts === 0) { toast.error('Enter a non-zero point value'); return }
    if (!loyaltyNote.trim()) { toast.error('Reason is required'); return }
    setSavingLoyalty(true)
    try {
      await adjustLoyaltyPoints(loyaltyCustomer.id, pts, loyaltyNote)
      toast.success(`${pts > 0 ? '+' : ''}${pts} points adjusted`)
      setLoyaltyCustomer(null); setLoyaltyPoints(''); setLoyaltyNote('')
      load()
    } catch { toast.error('Failed to adjust points') } finally { setSavingLoyalty(false) }
  }

  async function openAccount(c: Customer) {
    setAccountCustomer(c)
    const [acct, txs] = await Promise.all([getAcct(c.id), getAcctTxs(c.id)])
    setAccount(acct); setAccountTxs(txs)
    setPaymentAmount(''); setPaymentNote('')
  }

  async function handleAccountPayment() {
    if (!accountCustomer || !account) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return }
    if (amt > account.balance) { toast.error('Amount exceeds outstanding balance'); return }
    setSavingPayment(true)
    try {
      await payAcct(accountCustomer.id, amt, paymentNote || 'Payment received')
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
      c.phone?.includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.customer_code?.toLowerCase().includes(q)
    )
  }, [customers, search])

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, email, company..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100 bg-blue-50/50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Contact</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Group</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Total Spent</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Points</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No customers found</td></tr>
            ) : filtered.map(c => (
              <tr
                key={c.id}
                onClick={() => openDetail(c)}
                className="border-b border-blue-200/40 hover:bg-blue-50/40 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{c.full_name}</p>
                  {c.company && <p className="text-xs text-slate-400 mt-0.5">{c.company}</p>}
                  {c.customer_code && <p className="text-xs text-slate-400 font-mono">#{c.customer_code}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {c.phone && <p className="text-xs">{c.phone}</p>}
                  {c.email && <p className="text-xs">{c.email}</p>}
                  {!c.phone && !c.email && <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {c.customer_group ? (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">
                      {c.customer_group.name}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(c.total_spent)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('flex items-center justify-end gap-1 text-sm',
                    c.loyalty_points > 0 ? 'text-blue-500' : 'text-slate-300')}>
                    {c.loyalty_points > 0 && <Star size={11} />}
                    {c.loyalty_points}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <button title="House account" onClick={() => openAccount(c)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded transition-colors">
                      <BookUser size={13} />
                    </button>
                    <button title="Adjust loyalty" onClick={() => setLoyaltyCustomer(c)}
                      className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors">
                      <Gift size={13} />
                    </button>
                    <button title="Edit" onClick={() => { setEditing(c); setShowModal(true) }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <ChevronRight size={13} className="text-slate-300" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Customer Form Modal ── */}
      {showModal && (
        <CustomerModal customer={editing} onClose={() => setShowModal(false)} onSaved={load} />
      )}

      {/* ── Customer Detail Modal ── */}
      {detail && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-blue-200 rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{detail.full_name}</h2>
                {detail.company && <p className="text-xs text-slate-400 mt-0.5">{detail.company}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setDetail(null); setEditing(detail); setShowModal(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0 divide-x divide-blue-100">
              {/* Left: profile + stats */}
              <div className="w-72 shrink-0 p-5 overflow-y-auto space-y-4">
                {/* Contact */}
                <div className="space-y-2">
                  {detail.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400 shrink-0" /> {detail.phone}
                    </div>
                  )}
                  {detail.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={13} className="text-slate-400 shrink-0" /> {detail.email}
                    </div>
                  )}
                  {(detail.city || detail.address_line1) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      {[detail.address_line1, detail.city, detail.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {detail.customer_group && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                        {detail.customer_group.name}
                      </span>
                    </div>
                  )}
                  {detail.customer_code && (
                    <p className="text-xs text-slate-400 font-mono">Code: #{detail.customer_code}</p>
                  )}
                  <p className="text-xs text-slate-400">Customer since {formatDate(detail.created_at)}</p>
                  {detail.date_of_birth && (
                    <p className="text-xs text-slate-400">DOB: {detail.date_of_birth}</p>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Loyalty Points', value: `${detail.loyalty_points} pts`, highlight: detail.loyalty_points > 0 },
                    { label: 'Total Spent', value: formatCurrency(detail.total_spent) },
                    { label: 'Account Limit', value: formatCurrency(detail.account_limit ?? 0) },
                    { label: 'Sales', value: String(detailSales.length) },
                  ].map(s => (
                    <div key={s.label} className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
                      <p className={cn('text-sm font-bold mt-0.5', s.highlight ? 'text-blue-500' : 'text-slate-800')}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {detail.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">Notes</p>
                    <p className="text-xs text-amber-600">{detail.notes}</p>
                  </div>
                )}

                {/* Flags */}
                <div className="space-y-1">
                  {detail.tax_exempt && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium">
                      Tax Exempt
                    </span>
                  )}
                  {detail.marketing_opt_in && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full font-medium ml-1">
                      Marketing Opt-In
                    </span>
                  )}
                </div>

                {/* Quick actions */}
                <div className="space-y-2 pt-1">
                  <button onClick={() => { setDetail(null); openAccount(detail) }}
                    className="w-full py-2 text-sm text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5">
                    <BookUser size={14} /> House Account
                  </button>
                  <button onClick={() => { setDetail(null); setLoyaltyCustomer(detail) }}
                    className="w-full py-2 text-sm text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5">
                    <Gift size={14} /> Adjust Points
                  </button>
                </div>
              </div>

              {/* Right: sales history */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-5 py-3 border-b border-blue-100 shrink-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales History</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {detailSalesLoading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading...</div>
                  ) : detailSales.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-sm">No sales yet</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-blue-100">
                        <tr>
                          <th className="text-left px-5 py-2.5 text-slate-500 font-medium text-xs">Sale #</th>
                          <th className="text-left px-5 py-2.5 text-slate-500 font-medium text-xs">Date</th>
                          <th className="text-left px-5 py-2.5 text-slate-500 font-medium text-xs">Location</th>
                          <th className="text-left px-5 py-2.5 text-slate-500 font-medium text-xs">Payment</th>
                          <th className="text-right px-5 py-2.5 text-slate-500 font-medium text-xs">Total</th>
                          <th className="text-center px-5 py-2.5 text-slate-500 font-medium text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSales.map((sale: any) => (
                          <tr key={sale.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                            <td className="px-5 py-2.5 font-mono text-blue-500 text-xs">{sale.id.slice(0,8).toUpperCase()}</td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{sale.location?.name ?? '—'}</td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs capitalize">{sale.payment_method?.replace(/_/g, ' ')}</td>
                            <td className="px-5 py-2.5 text-right font-medium text-slate-900">{formatCurrency(sale.total)}</td>
                            <td className="px-5 py-2.5 text-center">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[sale.status] ?? '')}>
                                {sale.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── House Account Modal ── */}
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Record a Payment</p>
                <div className="flex gap-2">
                  <input type="number" min="0.01" step="0.01" placeholder="Amount"
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Note (optional)" value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

      {/* ── Loyalty Adjustment Modal ── */}
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
