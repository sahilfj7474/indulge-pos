'use client'

import { useState, useEffect, useMemo } from 'react'
import { Customer } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import CustomerModal from '@/components/customers/CustomerModal'
import { Plus, Search, Star, Pencil } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('full_name')
    setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
          <h1 className="text-xl font-bold text-white">Customers</h1>
          <p className="text-sm text-gray-400 mt-0.5">{customers.length} registered customers</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Total Spent</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Loyalty Pts</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Member Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">No customers found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{c.full_name}</td>
                <td className="px-4 py-3 text-gray-400">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(c.total_spent)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('flex items-center justify-end gap-1', c.loyalty_points > 0 ? 'text-indigo-400' : 'text-gray-500')}>
                    {c.loyalty_points > 0 && <Star size={11} />}
                    {c.loyalty_points}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setEditing(c); setShowModal(true) }}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
