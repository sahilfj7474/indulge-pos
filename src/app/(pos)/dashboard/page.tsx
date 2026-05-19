'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getDashboardStats, fetchSalesForReport, aggregateSalesTrend,
  aggregateByCategory, aggregateByDayOfWeek, aggregateByStaff,
  aggregateHourly, SaleRow,
} from '@/lib/services/reports.service'
import { getLocations } from '@/lib/services/admin.service'
import { localToday } from '@/lib/utils'
import { Location } from '@/types'
import { formatCurrency } from '@/lib/utils'
import DateRangePicker from '@/components/ui/DateRangePicker'
import LocationPicker from '@/components/ui/LocationPicker'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { TrendingUp, ShoppingCart, Users, BarChart2 } from 'lucide-react'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const TODAY = localToday()

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#e2e8f0' } },
    y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#e2e8f0' } },
  },
} as const

const CHART_COLORS = [
  '#3b82f6', '#6366f1', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6b7280',
]

type ChartTab = 'sales' | 'product_types' | 'days' | 'time' | 'team'

const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: 'sales',         label: 'Sales' },
  { id: 'product_types', label: 'Product Types' },
  { id: 'days',          label: 'Days' },
  { id: 'time',          label: 'Time' },
  { id: 'team',          label: 'Team' },
]

interface DashboardStats {
  totalRevenue: number
  totalExTax: number
  totalTransactions: number
  avgSaleValue: number
  grossProfit: number
  newCustomers: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [dateFrom,     setDateFrom]     = useState(TODAY)
  const [dateTo,       setDateTo]       = useState(TODAY)
  const [chartTab,     setChartTab]     = useState<ChartTab>('sales')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [locations,    setLocations]    = useState<Location[]>([])
  const [loading,      setLoading]      = useState(true)
  const [stats,        setStats]        = useState<DashboardStats>({
    totalRevenue: 0, totalExTax: 0, totalTransactions: 0,
    avgSaleValue: 0, grossProfit: 0, newCustomers: 0,
  })
  const [sales, setSales] = useState<SaleRow[]>([])

  // '' = All Stores (manager+); non-manager is always locked to their location
  const effectiveLocationId = isManager ? selectedLocationId : (user?.location_id ?? '')

  useEffect(() => {
    if (!isManager) return
    getLocations().then(locs => {
      setLocations(locs.filter(l => l.is_active !== false))
      // start with "All Stores" — selectedLocationId stays ''
    })
  }, [isManager])

  const load = useCallback(async () => {
    // Non-managers must have a location; managers can load with '' = all stores
    if (!isManager && !effectiveLocationId) return
    setLoading(true)
    const locationIdArr = effectiveLocationId ? [effectiveLocationId] : []
    const [statsData, salesData] = await Promise.all([
      getDashboardStats(effectiveLocationId, dateFrom, dateTo),
      fetchSalesForReport(locationIdArr, dateFrom, dateTo),
    ])
    setStats(statsData)
    setSales(salesData)
    setLoading(false)
  }, [effectiveLocationId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const trend      = aggregateSalesTrend(sales)
  const byCategory = aggregateByCategory(sales)
  const byDow      = aggregateByDayOfWeek(sales)
  const hourly     = aggregateHourly(sales)
  const byStaff    = aggregateByStaff(sales)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>

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
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="SALES (EX TAX)"
          value={formatCurrency(stats.totalExTax)}
          icon={<BarChart2 size={34} className="text-slate-200" />}
          valueClass="text-blue-600"
          loading={loading}
        />
        <KpiCard
          label="GROSS PROFIT"
          value={`${stats.grossProfit}%`}
          icon={<TrendingUp size={34} className="text-slate-200" />}
          valueClass="text-blue-500"
          loading={loading}
        />
        <KpiCard
          label="AVG. SALE VALUE"
          value={formatCurrency(stats.avgSaleValue)}
          icon={<ShoppingCart size={34} className="text-slate-200" />}
          valueClass="text-violet-600"
          loading={loading}
        />
        <KpiCard
          label="NEW CUSTOMERS"
          value={String(stats.newCustomers)}
          icon={<Users size={34} className="text-slate-200" />}
          valueClass="text-emerald-600"
          loading={loading}
        />
      </div>

      {/* ── Chart Section ── */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        {/* Underline tabs — matching HikeUp style */}
        <div className="flex border-b border-blue-100 overflow-x-auto">
          {CHART_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setChartTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                chartTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Loading...
            </div>
          ) : sales.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              No data for the selected period.
            </div>
          ) : (
            <div className="h-64">
              {chartTab === 'sales' && (
                <Line
                  data={{
                    labels: trend.labels.length > 0 ? trend.labels : [dateFrom],
                    datasets: [{
                      data: trend.data.length > 0 ? trend.data : [0],
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59,130,246,0.07)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: '#3b82f6',
                    }],
                  }}
                  options={{
                    ...CHART_OPTIONS,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => ` ${formatCurrency(ctx.raw as number)}`,
                        },
                      },
                    },
                  }}
                />
              )}

              {chartTab === 'product_types' && (
                byCategory.length === 0
                  ? <EmptyChart />
                  : <Bar
                      data={{
                        labels: byCategory.slice(0, 10).map(c => c.name),
                        datasets: [{
                          data: byCategory.slice(0, 10).map(c => c.total),
                          backgroundColor: CHART_COLORS,
                          borderRadius: 4,
                        }],
                      }}
                      options={CHART_OPTIONS}
                    />
              )}

              {chartTab === 'days' && (
                <Bar
                  data={{
                    labels: byDow.map(d => d.label),
                    datasets: [{
                      data: byDow.map(d => d.total),
                      backgroundColor: '#3b82f6',
                      borderRadius: 4,
                    }],
                  }}
                  options={CHART_OPTIONS}
                />
              )}

              {chartTab === 'time' && (
                <Bar
                  data={{
                    labels: hourly.map(h => h.label),
                    datasets: [{
                      data: hourly.map(h => h.total),
                      backgroundColor: '#6366f1',
                      borderRadius: 4,
                    }],
                  }}
                  options={CHART_OPTIONS}
                />
              )}

              {chartTab === 'team' && (
                byStaff.length === 0
                  ? <EmptyChart />
                  : <Bar
                      data={{
                        labels: byStaff.map(s => s.name),
                        datasets: [{
                          data: byStaff.map(s => s.total),
                          backgroundColor: CHART_COLORS,
                          borderRadius: 4,
                        }],
                      }}
                      options={CHART_OPTIONS}
                    />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!loading && (
        <p className="text-xs text-slate-400 text-right">
          {stats.totalTransactions} transactions
          {stats.totalTransactions > 0 && ` · ${formatCurrency(stats.totalRevenue)} gross revenue`}
        </p>
      )}
    </div>
  )
}

function KpiCard({
  label, value, icon, valueClass, loading,
}: {
  label: string
  value: string
  icon: React.ReactNode
  valueClass: string
  loading: boolean
}) {
  return (
    <div className="bg-white border border-blue-100 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-2xl font-bold truncate ${valueClass} ${loading ? 'opacity-30' : ''}`}>
            {loading ? '...' : value}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1.5">
            {label}
          </p>
        </div>
        <div className="shrink-0 mt-0.5">{icon}</div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
      No data for the selected period.
    </div>
  )
}
