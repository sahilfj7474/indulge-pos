'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  fetchSalesForReport, aggregateSalesTrend, aggregateByCategory,
  aggregateByProduct, aggregateByStaff, aggregateByPayment,
  aggregateHourly, buildZReportData, SaleRow,
} from '@/lib/services/reports.service'
import { formatCurrency, exportToCSV, cn } from '@/lib/utils'
import ZReportModal from '@/components/reports/ZReportModal'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Download, FileText, TrendingUp, Package, Users, CreditCard, Clock } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const TODAY = new Date().toISOString().slice(0, 10)
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
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
    y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
  },
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('summary')
  const [dateFrom, setDateFrom] = useState(TODAY)
  const [dateTo, setDateTo] = useState(TODAY)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [zType, setZType] = useState<'X' | 'Z' | null>(null)

  const load = useCallback(async () => {
    if (!user?.location_id) return
    setLoading(true)
    const data = await fetchSalesForReport(user.location_id, dateFrom, dateTo)
    setSales(data)
    setLoading(false)
  }, [user?.location_id, dateFrom, dateTo])

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
  const avgTx           = totalTx ? totalRevenue / totalTx : 0

  const zData = user
    ? buildZReportData(sales, user.location?.name ?? 'Store', dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`, user.full_name)
    : null

  const MetricCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">{loading ? 'Loading...' : `${totalTx} transactions`}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <span className="text-gray-500 self-center text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {/* Quick ranges */}
          {[
            { label: 'Today',     from: TODAY, to: TODAY },
            { label: 'This Week', from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10) })(), to: TODAY },
            { label: 'This Month',from: TODAY.slice(0,7) + '-01', to: TODAY },
          ].map(r => (
            <button key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors">
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-gray-900 p-1 rounded-lg border border-gray-800 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Summary tab */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Net Revenue"    value={formatCurrency(totalRevenue)} sub={`${totalTx} transactions`} />
            <MetricCard label="Avg. Sale"      value={formatCurrency(avgTx)} />
            <MetricCard label="Total Discount" value={formatCurrency(totalDiscount)} />
            <MetricCard label="Tax Collected"  value={formatCurrency(sales.reduce((s,r)=>s+r.tax_amount,0))} />
          </div>

          {trend.labels.length > 1 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Sales Trend</h3>
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
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
              Select a date range spanning multiple days to see the sales trend.
            </div>
          )}
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => exportToCSV(byProduct.map(p => ({ Product: p.name, 'Qty Sold': p.qty, Total: p.total })), 'top-products')}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
              <Download size={13} /> Export
            </button>
          </div>
          {byProduct.length > 0 ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Products by Revenue</h3>
                <Bar data={{
                  labels: byProduct.slice(0,10).map(p => p.name.length > 20 ? p.name.slice(0,18)+'…' : p.name),
                  datasets: [{ data: byProduct.slice(0,10).map(p => p.total), backgroundColor: CHART_COLORS }],
                }} options={{ ...CHART_OPTIONS, plugins: { legend: { display: false } } }} />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Qty Sold</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Revenue</th>
                  </tr></thead>
                  <tbody>{byProduct.map((p, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-white">{p.name}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{p.qty}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(p.total)}</td>
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{
                    labels: byCategory.map(c => c.name),
                    datasets: [{ data: byCategory.map(c => c.total), backgroundColor: CHART_COLORS, borderWidth: 0 }],
                  }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byCategory.map((c, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-white">{c.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
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
            <button onClick={() => exportToCSV(byStaff.map(s => ({ Staff: s.name, Transactions: s.count, Revenue: s.total, Discounts: s.discount })), 'sales-by-staff')}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
              <Download size={13} /> Export
            </button>
          </div>
          {byStaff.length > 0 ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <Bar data={{
                  labels: byStaff.map(s => s.name),
                  datasets: [{ data: byStaff.map(s => s.total), backgroundColor: CHART_COLORS }],
                }} options={CHART_OPTIONS} />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Cashier</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Discounts Given</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Revenue</th>
                  </tr></thead>
                  <tbody>{byStaff.map((s, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{s.count}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(s.discount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(s.total)}</td>
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{
                    labels: byPayment.map(p => p.method.replace('_',' ')),
                    datasets: [{ data: byPayment.map(p => p.total), backgroundColor: CHART_COLORS, borderWidth: 0 }],
                  }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden self-start">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Method</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byPayment.map((p, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 capitalize text-white">{p.method.replace('_',' ')}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(p.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Revenue by Hour of Day</h3>
          {sales.length > 0 ? (
            <Bar data={{
              labels: hourly.map(h => h.label),
              datasets: [{ data: hourly.map(h => h.total), backgroundColor: '#6366f1', borderRadius: 4 }],
            }} options={CHART_OPTIONS} />
          ) : <EmptyState />}
        </div>
      )}

      {/* Z/X Report tab */}
      {tab === 'zreport' && zData && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-w-md">
            <h3 className="text-sm font-semibold text-white mb-1">End of Day Report</h3>
            <p className="text-xs text-gray-400 mb-4">
              X-Report is a snapshot. Z-Report closes the day and records the summary.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setZType('X')}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg border border-gray-700 transition-colors">
                Print X-Report
              </button>
              <button onClick={() => setZType('Z')}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                Print Z-Report
              </button>
            </div>

            {/* Preview */}
            <div className="mt-4 space-y-1.5 text-sm border-t border-gray-800 pt-4">
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
                label === '—' ? <hr key={i} className="border-gray-800" /> : (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {zType && zData && (
        <ZReportModal data={zData} type={zType} onClose={() => setZType(null)} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500 text-sm">
      No data for the selected period.
    </div>
  )
}
