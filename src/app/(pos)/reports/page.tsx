'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  fetchSalesForReport, aggregateSalesTrend, aggregateByCategory,
  aggregateByProduct, aggregateByStaff, aggregateByPayment,
  aggregateHourly, buildZReportData, getRefundsTotal, SaleRow,
} from '@/lib/services/reports.service'
import { getLocations } from '@/lib/services/admin.service'
import { Location } from '@/types'
import { formatCurrency, cn, localToday } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/excel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import MultiLocationPicker from '@/components/ui/MultiLocationPicker'
import ZReportModal from '@/components/reports/ZReportModal'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Download, FileText, TrendingUp, Package, Users, CreditCard, Clock, ChevronDown } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const TODAY = localToday()
const CHART_COLORS = ['#6366f1','#3b82f6','#10b981','#f97316','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#6b7280']

type Tab = 'summary' | 'products' | 'categories' | 'staff' | 'payments' | 'hourly' | 'zreport'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'summary',    label: 'Summary',    icon: TrendingUp },
  { id: 'products',   label: 'Products',   icon: Package },
  { id: 'categories', label: 'Categories', icon: FileText },
  { id: 'staff',      label: 'Staff',      icon: Users },
  { id: 'payments',   label: 'Payments',   icon: CreditCard },
  { id: 'hourly',     label: 'Hourly',     icon: Clock },
  { id: 'zreport',    label: 'Z / X Report', icon: FileText },
]

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
  },
}

export default function ReportsPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const [tab,       setTab]       = useState<Tab>('summary')
  const [dateFrom,  setDateFrom]  = useState(TODAY)
  const [dateTo,    setDateTo]    = useState(TODAY)
  const [sales,     setSales]     = useState<SaleRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [zType,     setZType]     = useState<'X' | 'Z' | null>(null)
  const [refundsTotal,       setRefundsTotal]       = useState(0)
  const [locations,           setLocations]           = useState<Location[]>([])
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [exportOpen,          setExportOpen]          = useState(false)
  const [exportPos,          setExportPos]          = useState({ top: 0, right: 0 })
  const exportBtnRef  = useRef<HTMLButtonElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // [] = All Stores (manager+); non-manager locked to their location
  const effectiveLocationIds: string[] = isManager
    ? selectedLocationIds
    : (user?.location_id ? [user.location_id] : [])

  useEffect(() => {
    if (!isManager) return
    getLocations().then(locs => {
      setLocations(locs.filter(l => l.is_active !== false))
    })
  }, [isManager]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close export dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        exportBtnRef.current?.contains(e.target as Node) ||
        exportMenuRef.current?.contains(e.target as Node)
      ) return
      setExportOpen(false)
    }
    if (exportOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [exportOpen])

  function openExport() {
    if (exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect()
      setExportPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setExportOpen(o => !o)
  }

  const load = useCallback(async () => {
    if (!isManager && effectiveLocationIds.length === 0) return
    setLoading(true)
    const [data, refunds] = await Promise.all([
      fetchSalesForReport(effectiveLocationIds, dateFrom, dateTo),
      getRefundsTotal(effectiveLocationIds, dateFrom, dateTo),
    ])
    setSales(data)
    setRefundsTotal(refunds)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effectiveLocationIds), dateFrom, dateTo, isManager])

  useEffect(() => { load() }, [load])

  const trend      = aggregateSalesTrend(sales)
  const byCategory = aggregateByCategory(sales)
  const byProduct  = aggregateByProduct(sales, 15)
  const byStaff    = aggregateByStaff(sales)
  const byPayment  = aggregateByPayment(sales)
  const hourly     = aggregateHourly(sales)

  const totalRevenue    = sales.reduce((s, r) => s + r.total, 0)
  const totalTx         = sales.length
  const totalDiscount   = sales.reduce((s, r) => s + r.discount_amount, 0)
  const totalTax        = sales.reduce((s, r) => s + r.tax_amount, 0)
  const avgTx           = totalTx ? totalRevenue / totalTx : 0
  const totalExTax      = sales.reduce((s, r) => s + (r.total - r.tax_amount), 0)
  const totalCOGS       = sales.reduce((s, r) => s + r.items.reduce((is, item) => is + (item.product?.cost ?? 0) * item.quantity, 0), 0)
  const grossProfit     = totalExTax - totalCOGS
  const marginPct       = totalExTax > 0 ? (grossProfit / totalExTax) * 100 : 0
  const netSales        = totalRevenue - refundsTotal

  // Used for the Z-report tab preview panel
  const zLocationLabel = effectiveLocationIds.length === 0
    ? 'All Stores'
    : effectiveLocationIds.length === 1
    ? (locations.find(l => l.id === effectiveLocationIds[0])?.name ?? user?.location?.name ?? 'Store')
    : `${effectiveLocationIds.length} Stores`
  const zData = user
    ? buildZReportData(sales, zLocationLabel, dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`, user.full_name)
    : null

  // Full location label for Excel exports (lists all names when multi-selected)
  const exportLocationLabel = effectiveLocationIds.length === 0
    ? 'All Stores'
    : effectiveLocationIds.length === 1
    ? (locations.find(l => l.id === effectiveLocationIds[0])?.name ?? user?.location?.name ?? 'Store')
    : effectiveLocationIds.map(id => locations.find(l => l.id === id)?.name ?? id).join(', ')

  const MetricCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-white border border-blue-100 rounded-xl p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Loading...' : `${totalTx} transactions`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && locations.length > 0 && (
            <MultiLocationPicker
              locations={locations}
              selectedIds={selectedLocationIds}
              onChange={setSelectedLocationIds}
            />
          )}
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
          />
          {/* Export dropdown */}
          <div className="relative">
            <button
              ref={exportBtnRef}
              onClick={openExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none"
            >
              <Download size={13} /> Export <ChevronDown size={13} className={cn('transition-transform', exportOpen && 'rotate-180')} />
            </button>
            {exportOpen && (
              <div
                ref={exportMenuRef}
                style={{ position: 'fixed', top: exportPos.top, right: exportPos.right, zIndex: 9999 }}
                className="bg-white border border-blue-100 rounded-xl shadow-2xl overflow-hidden"
              >
                <button
                  onClick={() => {
                    exportToExcel({
                      filename:      `sales-detailed-${dateFrom}-${dateTo}`,
                      reportTitle:   'Detailed Sales Data',
                      locationLabel: exportLocationLabel,
                      dateFrom,
                      dateTo,
                      generatedBy:   user?.full_name ?? '',
                      sheets: [{
                        name:    'Detailed Sales',
                        columns: [
                          { header: 'Date',           key: 'date',     width: 16 },
                          { header: 'Cashier',        key: 'cashier',  width: 22 },
                          { header: 'Payment Method', key: 'payment',  width: 20 },
                          { header: 'Subtotal',       key: 'subtotal', width: 14, type: 'currency' },
                          { header: 'Discount',       key: 'discount', width: 14, type: 'currency' },
                          { header: 'Tax',            key: 'tax',      width: 12, type: 'currency' },
                          { header: 'Total',          key: 'total',    width: 14, type: 'currency' },
                        ],
                        data: sales.map(s => ({
                          date:     s.created_at.slice(0, 10),
                          cashier:  s.user?.full_name ?? '',
                          payment:  s.payment_method.replace(/_/g, ' '),
                          subtotal: s.subtotal,
                          discount: s.discount_amount,
                          tax:      s.tax_amount,
                          total:    s.total,
                        })),
                        totals: {
                          date:     'TOTALS',
                          subtotal: sales.reduce((sum, s) => sum + s.subtotal, 0),
                          discount: sales.reduce((sum, s) => sum + s.discount_amount, 0),
                          tax:      sales.reduce((sum, s) => sum + s.tax_amount, 0),
                          total:    sales.reduce((sum, s) => sum + s.total, 0),
                        },
                      }],
                    })
                    setExportOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 text-left whitespace-nowrap"
                >
                  <Download size={13} className="text-slate-400 shrink-0" /> Detailed Sales (Excel)
                </button>
                <button
                  onClick={() => {
                    exportToExcel({
                      filename:      `sales-summary-${dateFrom}-${dateTo}`,
                      reportTitle:   'Sales Performance Summary',
                      locationLabel: exportLocationLabel,
                      dateFrom,
                      dateTo,
                      generatedBy:   user?.full_name ?? '',
                      sheets: [{
                        name:    'Summary',
                        columns: [
                          { header: 'Metric',       key: 'metric', width: 36 },
                          { header: 'Value (FJD)',  key: 'value',  width: 20, align: 'right' },
                        ],
                        data: [
                          { metric: 'Gross Sales (incl. tax)',  value: `FJD ${totalRevenue.toFixed(2)}` },
                          { metric: 'Sales EX Tax',             value: `FJD ${totalExTax.toFixed(2)}` },
                          { metric: 'Refunds',                  value: `FJD ${refundsTotal.toFixed(2)}` },
                          { metric: 'Net Sales',                value: `FJD ${netSales.toFixed(2)}` },
                          { metric: 'Total Discounts',          value: `FJD ${totalDiscount.toFixed(2)}` },
                          { metric: 'Tax Collected',            value: `FJD ${totalTax.toFixed(2)}` },
                          { metric: 'Cost of Goods Sold (COGS)',value: `FJD ${totalCOGS.toFixed(2)}` },
                          { metric: 'Gross Profit',             value: `FJD ${grossProfit.toFixed(2)}` },
                          { metric: 'Gross Margin %',           value: `${marginPct.toFixed(1)}%` },
                          { metric: 'Total Transactions',       value: String(totalTx) },
                          { metric: 'Average Sale Value',       value: `FJD ${avgTx.toFixed(2)}` },
                        ],
                      }],
                    })
                    setExportOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 text-left whitespace-nowrap"
                >
                  <FileText size={13} className="text-slate-400 shrink-0" /> Performance Summary (Excel)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-white p-1 rounded-lg border border-blue-100 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800')}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Summary tab */}
      {tab === 'summary' && (
        <div className="space-y-4">
          {/* Row 1 — Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Gross Sales (incl. tax)" value={formatCurrency(totalRevenue)} sub={`${totalTx} transactions`} />
            <MetricCard label="Sales EX Tax"   value={formatCurrency(totalExTax)} />
            <MetricCard label="Avg. Sale"      value={formatCurrency(avgTx)} />
            <MetricCard label="Net Sales"      value={formatCurrency(netSales)} sub={refundsTotal > 0 ? `after ${formatCurrency(refundsTotal)} refunds` : 'no refunds'} />
          </div>
          {/* Row 2 — Cost & Profitability */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="COGS"           value={totalCOGS > 0 ? formatCurrency(totalCOGS) : '—'} sub="cost of goods sold" />
            <MetricCard label="Gross Profit"   value={totalCOGS > 0 ? formatCurrency(grossProfit) : '—'} sub="sales EX – COGS" />
            <MetricCard label="Margin %"       value={totalCOGS > 0 ? `${marginPct.toFixed(1)}%` : '—'} sub="gross profit / sales EX" />
            <MetricCard label="Total Discount" value={formatCurrency(totalDiscount)} sub={`Tax: ${formatCurrency(totalTax)}`} />
          </div>

          {trend.labels.length > 1 ? (
            <div className="bg-white border border-blue-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-600 mb-3">Sales Trend</h3>
              <div className="h-64">
                <Line data={{
                  labels: trend.labels,
                  datasets: [{
                    data: trend.data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1',
                  }],
                }} options={CHART_OPTIONS} />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-blue-100 rounded-xl p-8 text-center text-slate-400 text-sm">
              Select a date range spanning multiple days to see the sales trend.
            </div>
          )}
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => exportToExcel({
                filename:      `top-products-${dateFrom}-${dateTo}`,
                reportTitle:   'Top Products by Revenue',
                locationLabel: exportLocationLabel,
                dateFrom,
                dateTo,
                generatedBy:   user?.full_name ?? '',
                sheets: [{
                  name:    'Top Products',
                  columns: [
                    { header: 'Rank',       key: 'rank',  width: 8,  type: 'integer', align: 'center' },
                    { header: 'Product',    key: 'name',  width: 34 },
                    { header: 'Qty Sold',   key: 'qty',   width: 14, type: 'integer' },
                    { header: 'Revenue',    key: 'total', width: 16, type: 'currency' },
                  ],
                  data: byProduct.map((p, i) => ({ rank: i + 1, name: p.name, qty: p.qty, total: p.total })),
                  totals: {
                    name:  'TOTAL',
                    qty:   byProduct.reduce((s, p) => s + p.qty, 0),
                    total: byProduct.reduce((s, p) => s + p.total, 0),
                  },
                }],
              })}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm rounded-lg">
              <Download size={13} /> Export Excel
            </button>
          </div>
          {byProduct.length > 0 ? (
            <>
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-600 mb-3">Top Products by Revenue</h3>
                <div className="h-64">
                  <Bar data={{
                    labels: byProduct.slice(0,10).map(p => p.name.length > 20 ? p.name.slice(0,18)+'…' : p.name),
                    datasets: [{ data: byProduct.slice(0,10).map(p => p.total), backgroundColor: CHART_COLORS }],
                  }} options={{ ...CHART_OPTIONS, plugins: { legend: { display: false } } }} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Qty Sold</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                  </tr></thead>
                  <tbody>{byProduct.map((p, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{p.qty}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : <EmptyState />}
        </div>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="space-y-4">
          {byCategory.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{
                    labels: byCategory.map(c => c.name),
                    datasets: [{ data: byCategory.map(c => c.total), backgroundColor: CHART_COLORS, borderWidth: 0 }],
                  }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Category</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byCategory.map((c, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-slate-900">{c.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {totalRevenue ? ((c.total / totalRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* Staff tab */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => exportToExcel({
                filename:      `staff-performance-${dateFrom}-${dateTo}`,
                reportTitle:   'Staff Sales Performance',
                locationLabel: exportLocationLabel,
                dateFrom,
                dateTo,
                generatedBy:   user?.full_name ?? '',
                sheets: [{
                  name:    'Staff Performance',
                  columns: [
                    { header: 'Cashier',         key: 'name',     width: 26 },
                    { header: 'Transactions',     key: 'count',    width: 16, type: 'integer' },
                    { header: 'Discounts Given',  key: 'discount', width: 18, type: 'currency' },
                    { header: 'Revenue',          key: 'total',    width: 16, type: 'currency' },
                  ],
                  data: byStaff.map(s => ({ name: s.name, count: s.count, discount: s.discount, total: s.total })),
                  totals: {
                    name:     'TOTALS',
                    count:    byStaff.reduce((s, r) => s + r.count, 0),
                    discount: byStaff.reduce((s, r) => s + r.discount, 0),
                    total:    byStaff.reduce((s, r) => s + r.total, 0),
                  },
                }],
              })}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm rounded-lg">
              <Download size={13} /> Export Excel
            </button>
          </div>
          {byStaff.length > 0 ? (
            <>
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <div className="h-64">
                  <Bar data={{
                    labels: byStaff.map(s => s.name),
                    datasets: [{ data: byStaff.map(s => s.total), backgroundColor: CHART_COLORS }],
                  }} options={CHART_OPTIONS} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Cashier</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Discounts Given</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                  </tr></thead>
                  <tbody>{byStaff.map((s, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.count}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(s.discount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : <EmptyState />}
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {byPayment.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{
                    labels: byPayment.map(p => p.method.replace('_',' ')),
                    datasets: [{ data: byPayment.map(p => p.total), backgroundColor: CHART_COLORS, borderWidth: 0 }],
                  }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden self-start">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Method</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byPayment.map((p, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 capitalize text-slate-900">{p.method.replace('_',' ')}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {totalRevenue ? ((p.total / totalRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* Hourly tab */}
      {tab === 'hourly' && (
        <div className="bg-white border border-blue-100 rounded-xl p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Revenue by Hour of Day</h3>
          {sales.length > 0 ? (
            <div className="h-64">
              <Bar data={{
                labels: hourly.map(h => h.label),
                datasets: [{ data: hourly.map(h => h.total), backgroundColor: '#6366f1', borderRadius: 4 }],
              }} options={CHART_OPTIONS} />
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* Z/X Report tab */}
      {tab === 'zreport' && zData && (
        <div className="space-y-4">
          <div className="bg-white border border-blue-100 rounded-xl p-5 max-w-md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">End of Day Report</h3>
            <p className="text-xs text-slate-500 mb-4">
              X-Report is a snapshot. Z-Report closes the day and records the summary.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setZType('X')}
                className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-slate-900 text-sm font-medium rounded-lg border border-blue-200 transition-colors">
                Print X-Report
              </button>
              <button onClick={() => setZType('Z')}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Print Z-Report
              </button>
            </div>

            {/* Preview */}
            <div className="mt-4 space-y-1.5 text-sm border-t border-blue-100 pt-4">
              {[
                ['Transactions',   String(zData.totalTransactions)],
                ['Gross Sales',    formatCurrency(zData.totalSales)],
                ['Total Discount', formatCurrency(zData.totalDiscount)],
                ['Net Sales',      formatCurrency(zData.netSales)],
                ['Tax Collected',  formatCurrency(zData.totalTax)],
                ['—', ''],
                ['Cash',           formatCurrency(zData.cashSales)],
                ['Card',           formatCurrency(zData.cardSales)],
                ['Bank Transfer',  formatCurrency(zData.bankSales)],
                ['Loyalty Points', formatCurrency(zData.loyaltySales)],
              ].map(([label, value], i) =>
                label === '—' ? <hr key={i} className="border-blue-100" /> : (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-900 font-medium">{value}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {zType && (
        <ZReportModal
          type={zType}
          locations={locations}
          initialSelectedIds={effectiveLocationIds}
          dateFrom={dateFrom}
          dateTo={dateTo}
          cashierName={user?.full_name ?? ''}
          onClose={() => setZType(null)}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-blue-100 rounded-xl p-12 text-center text-slate-400 text-sm">
      No data for the selected period.
    </div>
  )
}