'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sale, Location } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { getSales, getSaleById } from '@/lib/services/sales.service'
import { getLocations } from '@/lib/services/admin.service'
import { formatCurrency, formatDateTime, cn, localToday, localDayStart, localDayEnd } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/excel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import LocationPicker from '@/components/ui/LocationPicker'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { Search, Download } from 'lucide-react'
import { canVoidSale } from '@/lib/permissions'

const STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-100 text-green-600',
  voided:         'bg-red-100 text-red-500',
  refunded:       'bg-yellow-100 text-yellow-700',
  partial_refund: 'bg-orange-100 text-orange-600',
}

const TODAY = localToday()

export default function SalesPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [sales,        setSales]        = useState<Sale[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom,     setDateFrom]     = useState(TODAY)
  const [dateTo,       setDateTo]       = useState(TODAY)
  const [locations,          setLocations]          = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')

  // Detail panel state
  const [selectedSale,  setSelectedSale]  = useState<Sale | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [detailLoading, setDetailLoading] = useState(false)

  // '' = All Stores (manager+); non-manager locked to their location
  const effectiveLocationId = isManager ? selectedLocationId : (user?.location_id ?? '')

  useEffect(() => {
    if (!isManager) return
    getLocations().then(locs => {
      setLocations(locs.filter(l => l.is_active !== false))
      // start with "All Stores" — selectedLocationId stays ''
    })
  }, [isManager]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const data = await getSales({
      locationId:    effectiveLocationId || undefined,
      dateFrom:      localDayStart(dateFrom),
      dateTo:        localDayEnd(dateTo),
      status:        statusFilter || undefined,
      paymentMethod: methodFilter || undefined,
    })
    setSales(data)
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user, effectiveLocationId, dateFrom, dateTo, statusFilter, methodFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search) return sales
    const q = search.toLowerCase()
    return sales.filter(s =>
      s.id.slice(0, 8).toLowerCase().includes(q) ||
      (s.customer as unknown as { full_name: string })?.full_name?.toLowerCase().includes(q) ||
      (s.user    as unknown as { full_name: string })?.full_name?.toLowerCase().includes(q)
    )
  }, [sales, search])

  const totals = useMemo(() => ({
    count:   filtered.filter(s => s.status === 'completed').length,
    revenue: filtered.filter(s => s.status === 'completed').reduce((s, r) => s + r.total, 0),
  }), [filtered])

  async function openDetail(sale: Sale, index: number) {
    setSelectedIndex(index)
    setSelectedSale(sale) // show immediately with list data
    setDetailLoading(true)
    try {
      const full = await getSaleById(sale.id)
      if (full) setSelectedSale(full)
    } finally {
      setDetailLoading(false)
    }
  }

  async function navigateTo(index: number) {
    if (index < 0 || index >= filtered.length) return
    await openDetail(filtered[index], index)
  }

  function handleExport() {
    const locationLabel = isManager
      ? (selectedLocationId
          ? (locations.find(l => l.id === selectedLocationId)?.name ?? 'Store')
          : 'All Stores')
      : (user?.location?.name ?? 'Store')

    exportToExcel({
      filename:      `sales-${dateFrom}-to-${dateTo}`,
      reportTitle:   'Sales History Report',
      locationLabel,
      dateFrom,
      dateTo,
      generatedBy:   user?.full_name ?? 'Unknown',
      sheets: [{
        name:    'Sales History',
        columns: [
          { header: 'Receipt #',      key: 'receipt',  width: 14 },
          { header: 'Date & Time',    key: 'date',     width: 22 },
          { header: 'Cashier',        key: 'cashier',  width: 22 },
          { header: 'Customer',       key: 'customer', width: 24 },
          { header: 'Payment Method', key: 'payment',  width: 18 },
          { header: 'Subtotal',       key: 'subtotal', width: 14, type: 'currency' },
          { header: 'Discount',       key: 'discount', width: 14, type: 'currency' },
          { header: 'Tax',            key: 'tax',      width: 12, type: 'currency' },
          { header: 'Total',          key: 'total',    width: 14, type: 'currency' },
          { header: 'Status',         key: 'status',   width: 16, align: 'center' },
        ],
        data: filtered.map(s => ({
          receipt:  s.id.slice(0, 8).toUpperCase(),
          date:     formatDateTime(s.created_at),
          cashier:  (s.user    as unknown as { full_name: string })?.full_name ?? '',
          customer: (s.customer as unknown as { full_name: string })?.full_name ?? 'Walk-in',
          payment:  s.payment_method.replace(/_/g, ' '),
          subtotal: s.subtotal,
          discount: s.discount_amount,
          tax:      s.tax_amount,
          total:    s.total,
          status:   s.status.replace(/_/g, ' '),
        })),
        totals: {
          receipt:  'TOTALS',
          subtotal: filtered.reduce((sum, s) => sum + s.subtotal, 0),
          discount: filtered.reduce((sum, s) => sum + s.discount_amount, 0),
          tax:      filtered.reduce((sum, s) => sum + s.tax_amount, 0),
          total:    filtered.reduce((sum, s) => sum + s.total, 0),
        },
      }],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales History</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totals.count} transactions · {formatCurrency(totals.revenue)} revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && locations.length > 0 && (
            <LocationPicker
              locations={locations}
              selectedId={selectedLocationId}
              onChange={setSelectedLocationId}
            />
          )}
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search receipt #, customer, cashier..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="loyalty_points">Loyalty Points</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Receipt #</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date & Time</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Cashier</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Payment</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No sales found for this period</td></tr>
            ) : filtered.map((sale, idx) => (
              <tr
                key={sale.id}
                onClick={() => openDetail(sale, idx)}
                className={cn(
                  'border-b border-blue-200/50 cursor-pointer transition-colors',
                  selectedSale?.id === sale.id
                    ? 'bg-blue-50'
                    : 'hover:bg-blue-50/40'
                )}
              >
                <td className="px-4 py-3 font-mono text-blue-500 text-xs font-semibold">
                  {sale.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(sale.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(sale.user as unknown as { full_name: string })?.full_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {(sale.customer as unknown as { full_name: string })?.full_name ?? 'Walk-in'}
                </td>
                <td className="px-4 py-3 text-slate-500 capitalize">
                  {sale.payment_method.replace('_', ' ')}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(sale.total)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[sale.status] ?? '')}>
                    {sale.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selectedSale && user && (
        <SaleDetailModal
          sale={selectedSale}
          userId={user.id}
          canVoid={canVoidSale(user.role)}
          canRefund={canVoidSale(user.role)}
          onClose={() => { setSelectedSale(null); setSelectedIndex(-1) }}
          onVoided={() => { load(); setSelectedSale(null) }}
          onRefunded={() => { load() }}
          onPrev={() => navigateTo(selectedIndex - 1)}
          onNext={() => navigateTo(selectedIndex + 1)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filtered.length - 1}
        />
      )}

      {/* Loading overlay when navigating */}
      {detailLoading && selectedSale && (
        <div className="fixed bottom-4 right-4 z-[60] bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          Loading details...
        </div>
      )}
    </div>
  )
}
