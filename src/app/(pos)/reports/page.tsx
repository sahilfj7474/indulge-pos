'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  fetchSalesForReport, aggregateSalesTrend, aggregateByCategory,
  aggregateByProduct, aggregateByStaff, aggregateByPayment,
  aggregateHourly, buildZReportData, getRefundsTotal,
  aggregateDailySummary, aggregateByDayOfWeek, aggregateProductMargin,
  aggregateDiscountByStaff, getTopCustomers, getRefundDetails,
  SaleRow, CustomerRow, RefundRow,
} from '@/lib/services/reports.service'
import { getLocations } from '@/lib/services/admin.service'
import { Location } from '@/types'
import { formatCurrency, formatDateTime, cn, localToday } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/excel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import MultiLocationPicker from '@/components/ui/MultiLocationPicker'
import ZReportModal from '@/components/reports/ZReportModal'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Download, FileText, TrendingUp, Package, Users, CreditCard,
  Clock, ChevronDown, CalendarDays, Percent, Tag, UserCheck,
  RotateCcw, Layers,
} from 'lucide-react'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const TODAY = localToday()
const CHART_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f97316','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f59e0b','#6b7280',
]

const CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
  },
}

type Tab =
  | 'summary' | 'daily' | 'products' | 'margin' | 'categories'
  | 'staff' | 'discounts' | 'customers' | 'payments'
  | 'hourly' | 'dayofweek' | 'refunds' | 'zreport'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'summary',    label: 'Summary',      icon: TrendingUp },
  { id: 'daily',      label: 'Daily',        icon: CalendarDays },
  { id: 'products',   label: 'Products',     icon: Package },
  { id: 'margin',     label: 'Margin',       icon: Percent },
  { id: 'categories', label: 'Categories',   icon: Layers },
  { id: 'staff',      label: 'Staff',        icon: Users },
  { id: 'discounts',  label: 'Discounts',    icon: Tag },
  { id: 'customers',  label: 'Customers',    icon: UserCheck },
  { id: 'payments',   label: 'Payments',     icon: CreditCard },
  { id: 'hourly',     label: 'Hourly',       icon: Clock },
  { id: 'dayofweek',  label: 'Day of Week',  icon: CalendarDays },
  { id: 'refunds',    label: 'Refunds',      icon: RotateCcw },
  { id: 'zreport',    label: 'Z / X Report', icon: FileText },
]

// ── Shared sub-components ────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-blue-100 rounded-xl p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyState({ message = 'No data for the selected period.' }: { message?: string }) {
  return (
    <div className="bg-white border border-blue-100 rounded-xl p-12 text-center text-slate-400 text-sm">
      {message}
    </div>
  )
}

function TabExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm rounded-lg transition-colors"
    >
      <Download size={13} /> Export Excel
    </button>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [tab,       setTab]       = useState<Tab>('summary')
  const [dateFrom,  setDateFrom]  = useState(TODAY)
  const [dateTo,    setDateTo]    = useState(TODAY)
  const [loading,   setLoading]   = useState(false)
  const [zType,     setZType]     = useState<'X' | 'Z' | null>(null)

  const [locations,            setLocations]            = useState<Location[]>([])
  const [selectedLocationIds,  setSelectedLocationIds]  = useState<string[]>([])
  const [sales,                setSales]                = useState<SaleRow[]>([])
  const [refundsTotal,         setRefundsTotal]         = useState(0)
  const [topCustomers,         setTopCustomers]         = useState<CustomerRow[]>([])
  const [refundDetails,        setRefundDetails]        = useState<RefundRow[]>([])

  const [exportOpen, setExportOpen] = useState(false)
  const [exportPos,  setExportPos]  = useState({ top: 0, right: 0 })
  const exportBtnRef  = useRef<HTMLButtonElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const effectiveLocationIds: string[] = isManager
    ? selectedLocationIds
    : (user?.location_id ? [user.location_id] : [])

  // ── Load locations ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isManager) return
    getLocations().then(locs => setLocations(locs.filter(l => l.is_active !== false)))
  }, [isManager]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close export dropdown on outside click ──────────────────────────────
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
      const r = exportBtnRef.current.getBoundingClientRect()
      setExportPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setExportOpen(o => !o)
  }

  // ── Main data load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!isManager && effectiveLocationIds.length === 0) return
    setLoading(true)
    const [data, refTotal, customers, refunds] = await Promise.all([
      fetchSalesForReport(effectiveLocationIds, dateFrom, dateTo),
      getRefundsTotal(effectiveLocationIds, dateFrom, dateTo),
      getTopCustomers(effectiveLocationIds, dateFrom, dateTo),
      getRefundDetails(effectiveLocationIds, dateFrom, dateTo),
    ])
    setSales(data)
    setRefundsTotal(refTotal)
    setTopCustomers(customers)
    setRefundDetails(refunds)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effectiveLocationIds), dateFrom, dateTo, isManager])

  useEffect(() => { load() }, [load])

  // ── Aggregations (all derived from `sales`) ─────────────────────────────
  const trend        = aggregateSalesTrend(sales)
  const byCategory   = aggregateByCategory(sales)
  const byProduct    = aggregateByProduct(sales, 25)
  const byStaff      = aggregateByStaff(sales)
  const byPayment    = aggregateByPayment(sales)
  const hourly       = aggregateHourly(sales)
  const dailySummary = aggregateDailySummary(sales)
  const byDayOfWeek  = aggregateByDayOfWeek(sales)
  const byMargin     = aggregateProductMargin(sales)
  const byDiscount   = aggregateDiscountByStaff(sales)

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const totalRevenue  = sales.reduce((s, r) => s + r.total, 0)
  const totalTx       = sales.length
  const totalDiscount = sales.reduce((s, r) => s + r.discount_amount, 0)
  const totalTax      = sales.reduce((s, r) => s + r.tax_amount, 0)
  const totalExTax    = sales.reduce((s, r) => s + (r.total - r.tax_amount), 0)
  const totalCOGS     = sales.reduce((s, r) => s + r.items.reduce((acc, item) => acc + (item.product?.cost ?? 0) * item.quantity, 0), 0)
  const grossProfit   = totalExTax - totalCOGS
  const marginPct     = totalExTax > 0 ? (grossProfit / totalExTax) * 100 : 0
  const netSales      = totalRevenue - refundsTotal
  const avgTx         = totalTx ? totalRevenue / totalTx : 0

  // ── Location label helpers ────────────────────────────────────────────────
  const exportLocationLabel = effectiveLocationIds.length === 0
    ? 'All Stores'
    : effectiveLocationIds.length === 1
    ? (locations.find(l => l.id === effectiveLocationIds[0])?.name ?? user?.location?.name ?? 'Store')
    : effectiveLocationIds.map(id => locations.find(l => l.id === id)?.name ?? id).join(', ')

  const zLocationLabel = effectiveLocationIds.length === 0
    ? 'All Stores'
    : effectiveLocationIds.length === 1
    ? (locations.find(l => l.id === effectiveLocationIds[0])?.name ?? user?.location?.name ?? 'Store')
    : `${effectiveLocationIds.length} Stores`

  const zData = user
    ? buildZReportData(sales, zLocationLabel, dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`, user.full_name)
    : null

  // ── Common Excel options ─────────────────────────────────────────────────
  const xlBase = {
    locationLabel: exportLocationLabel,
    dateFrom,
    dateTo,
    generatedBy: user?.full_name ?? '',
  }

  // ── Full Report: 12-sheet workbook ────────────────────────────────────────
  function exportFullReport() {
    exportToExcel({
      ...xlBase,
      filename:    `indulge-full-report-${dateFrom}-${dateTo}`,
      reportTitle: 'Full Sales Report',
      sheets: [
        // 1 – Performance Summary
        {
          name:    'Performance Summary',
          kpis: [
            { label: 'Gross Sales',   value: `FJD ${totalRevenue.toFixed(2)}` },
            { label: 'Net Sales',     value: `FJD ${netSales.toFixed(2)}` },
            { label: 'Gross Profit',  value: totalCOGS > 0 ? `FJD ${grossProfit.toFixed(2)}` : '—' },
            { label: 'Transactions',  value: String(totalTx) },
          ],
          columns: [
            { header: 'Metric', key: 'metric', width: 40 },
            { header: 'Value',  key: 'value',  width: 24, align: 'right' },
          ],
          data: [
            { _section: true, metric: '◆  REVENUE' },
            { metric: 'Gross Sales (incl. tax)',   value: `FJD ${totalRevenue.toFixed(2)}` },
            { metric: 'Sales EX Tax',              value: `FJD ${totalExTax.toFixed(2)}` },
            { metric: 'Refunds',                   value: `FJD ${refundsTotal.toFixed(2)}` },
            { metric: 'Net Sales',                 value: `FJD ${netSales.toFixed(2)}` },
            { _section: true, metric: '◆  PROFITABILITY' },
            { metric: 'Cost of Goods Sold (COGS)', value: totalCOGS > 0 ? `FJD ${totalCOGS.toFixed(2)}` : 'N/A (no cost data)' },
            { metric: 'Gross Profit',              value: totalCOGS > 0 ? `FJD ${grossProfit.toFixed(2)}` : 'N/A' },
            { metric: 'Gross Margin %',            value: totalCOGS > 0 ? `${marginPct.toFixed(1)}%` : 'N/A' },
            { _section: true, metric: '◆  DISCOUNTS & TAX' },
            { metric: 'Total Discounts Given',     value: `FJD ${totalDiscount.toFixed(2)}` },
            { metric: 'Discount Rate (% of sales)', value: totalRevenue > 0 ? `${((totalDiscount / totalRevenue) * 100).toFixed(1)}%` : '0%' },
            { metric: 'Tax Collected',             value: `FJD ${totalTax.toFixed(2)}` },
            { _section: true, metric: '◆  OPERATIONS' },
            { metric: 'Total Transactions',        value: String(totalTx) },
            { metric: 'Average Sale Value',        value: `FJD ${avgTx.toFixed(2)}` },
            { metric: 'Refund Transactions',       value: String(refundDetails.length) },
            { metric: 'Top Performing Day',        value: dailySummary.sort((a,b) => b.total-a.total)[0]?.date ?? '—' },
            { metric: 'Busiest Hour',              value: [...hourly].sort((a,b) => b.total-a.total)[0]?.label ?? '—' },
          ],
        },
        // 2 – Daily Breakdown
        {
          name:    'Daily Breakdown',
          kpis: [
            { label: 'Days Active',    value: String(dailySummary.filter(d => d.count > 0).length) },
            { label: 'Best Day Rev.',  value: dailySummary.length ? `FJD ${Math.max(...dailySummary.map(d => d.total)).toFixed(2)}` : '—' },
            { label: 'Total Revenue',  value: `FJD ${totalRevenue.toFixed(2)}` },
            { label: 'Avg Daily Rev.', value: dailySummary.length ? `FJD ${(totalRevenue / dailySummary.length).toFixed(2)}` : '—' },
          ],
          columns: [
            { header: 'Date',         key: 'date',     width: 14 },
            { header: 'Transactions', key: 'count',    width: 16, type: 'integer' },
            { header: 'Items Sold',   key: 'items',    width: 14, type: 'integer' },
            { header: 'Subtotal',     key: 'subtotal', width: 14, type: 'currency' },
            { header: 'Discounts',    key: 'discount', width: 14, type: 'currency' },
            { header: 'Tax',          key: 'tax',      width: 12, type: 'currency' },
            { header: 'Total',        key: 'total',    width: 14, type: 'currency' },
            { header: 'Avg. Sale',    key: 'avg',      width: 14, type: 'currency' },
          ],
          data: dailySummary,
          totals: {
            date:     'TOTALS',
            count:    dailySummary.reduce((s, d) => s + d.count, 0),
            items:    dailySummary.reduce((s, d) => s + d.items, 0),
            subtotal: dailySummary.reduce((s, d) => s + d.subtotal, 0),
            discount: dailySummary.reduce((s, d) => s + d.discount, 0),
            tax:      dailySummary.reduce((s, d) => s + d.tax, 0),
            total:    dailySummary.reduce((s, d) => s + d.total, 0),
          },
        },
        // 3 – Top Products
        {
          name:    'Top Products',
          kpis: [
            { label: 'Products Sold',  value: String(byProduct.length) },
            { label: 'Total Units',    value: String(byProduct.reduce((s, p) => s + p.qty, 0)) },
            { label: 'Total Revenue',  value: `FJD ${byProduct.reduce((s, p) => s + p.total, 0).toFixed(2)}` },
            { label: 'Top Product',    value: byProduct[0]?.name ?? '—' },
          ],
          columns: [
            { header: 'Rank',     key: 'rank',  width: 8,  type: 'integer', align: 'center' },
            { header: 'Product',  key: 'name',  width: 36 },
            { header: 'Qty Sold', key: 'qty',   width: 14, type: 'integer' },
            { header: 'Revenue',  key: 'total', width: 16, type: 'currency' },
          ],
          data:   byProduct.map((p, i) => ({ rank: i + 1, name: p.name, qty: p.qty, total: p.total })),
          totals: { name: 'TOTAL', qty: byProduct.reduce((s, p) => s + p.qty, 0), total: byProduct.reduce((s, p) => s + p.total, 0) },
        },
        // 4 – Product Margin
        {
          name:    'Product Margin',
          kpis: [
            { label: 'Total Revenue',  value: `FJD ${byMargin.reduce((s, p) => s + p.revenue, 0).toFixed(2)}` },
            { label: 'Total COGS',     value: `FJD ${byMargin.reduce((s, p) => s + p.cost, 0).toFixed(2)}` },
            { label: 'Gross Profit',   value: `FJD ${byMargin.reduce((s, p) => s + p.profit, 0).toFixed(2)}` },
            { label: 'Products',       value: String(byMargin.length) },
          ],
          columns: [
            { header: 'Product',       key: 'name',    width: 34 },
            { header: 'Qty Sold',      key: 'qty',     width: 12, type: 'integer' },
            { header: 'Revenue',       key: 'revenue', width: 16, type: 'currency' },
            { header: 'COGS',          key: 'cost',    width: 16, type: 'currency' },
            { header: 'Gross Profit',  key: 'profit',  width: 16, type: 'currency' },
            { header: 'Margin %',      key: 'margin',  width: 12, type: 'percent' },
          ],
          data:   byMargin,
          totals: {
            name:    'TOTAL',
            qty:     byMargin.reduce((s, p) => s + p.qty, 0),
            revenue: byMargin.reduce((s, p) => s + p.revenue, 0),
            cost:    byMargin.reduce((s, p) => s + p.cost, 0),
            profit:  byMargin.reduce((s, p) => s + p.profit, 0),
          },
        },
        // 5 – Sales by Category
        {
          name:    'Sales by Category',
          columns: [
            { header: 'Category',   key: 'name',  width: 28 },
            { header: 'Revenue',    key: 'total', width: 18, type: 'currency' },
            { header: 'Share %',    key: 'share', width: 12, type: 'percent' },
          ],
          data:   byCategory.map(c => ({
            name:  c.name,
            total: c.total,
            share: totalRevenue > 0 ? parseFloat(((c.total / totalRevenue) * 100).toFixed(1)) : 0,
          })),
          totals: { name: 'TOTAL', total: byCategory.reduce((s, c) => s + c.total, 0), share: 100 },
        },
        // 6 – Staff Performance
        {
          name:    'Staff Performance',
          kpis: [
            { label: 'Staff Members',     value: String(byStaff.length) },
            { label: 'Total Transactions', value: String(byStaff.reduce((s, r) => s + r.count, 0)) },
            { label: 'Total Revenue',     value: `FJD ${byStaff.reduce((s, r) => s + r.total, 0).toFixed(2)}` },
            { label: 'Top Performer',     value: byStaff[0]?.name ?? '—' },
          ],
          columns: [
            { header: 'Cashier',         key: 'name',     width: 26 },
            { header: 'Transactions',    key: 'count',    width: 16, type: 'integer' },
            { header: 'Avg Sale',        key: 'avg',      width: 14, type: 'currency' },
            { header: 'Discounts Given', key: 'discount', width: 18, type: 'currency' },
            { header: 'Revenue',         key: 'total',    width: 16, type: 'currency' },
          ],
          data:   byStaff,
          totals: {
            name:     'TOTALS',
            count:    byStaff.reduce((s, r) => s + r.count, 0),
            discount: byStaff.reduce((s, r) => s + r.discount, 0),
            total:    byStaff.reduce((s, r) => s + r.total, 0),
          },
        },
        // 7 – Discount Analysis
        {
          name:    'Discount Analysis',
          kpis: [
            { label: 'Total Discounts',   value: `FJD ${totalDiscount.toFixed(2)}` },
            { label: 'Discounted Sales',  value: String(sales.filter(s => s.discount_amount > 0).length) },
            { label: 'Discount Rate',     value: totalTx > 0 ? `${((sales.filter(s => s.discount_amount > 0).length / totalTx) * 100).toFixed(1)}%` : '0%' },
            { label: 'Avg Discount',      value: sales.filter(s => s.discount_amount > 0).length > 0
                ? `FJD ${(totalDiscount / sales.filter(s => s.discount_amount > 0).length).toFixed(2)}`
                : 'FJD 0.00' },
          ],
          columns: [
            { header: 'Cashier',              key: 'name',           width: 26 },
            { header: 'Total Sales',          key: 'count',          width: 14, type: 'integer' },
            { header: 'Sales with Discount',  key: 'with_discount',  width: 20, type: 'integer' },
            { header: 'Discount Rate %',      key: 'discount_rate',  width: 18, type: 'percent' },
            { header: 'Total Discounts',      key: 'discount_total', width: 18, type: 'currency' },
            { header: 'Avg Discount / Sale',  key: 'avg_discount',   width: 20, type: 'currency' },
          ],
          data:   byDiscount,
          totals: {
            name:           'TOTALS',
            count:          byDiscount.reduce((s, r) => s + r.count, 0),
            with_discount:  byDiscount.reduce((s, r) => s + r.with_discount, 0),
            discount_total: byDiscount.reduce((s, r) => s + r.discount_total, 0),
          },
        },
        // 8 – Payment Breakdown
        {
          name:    'Payment Breakdown',
          columns: [
            { header: 'Payment Method', key: 'method', width: 22 },
            { header: 'Transactions',   key: 'count',  width: 16, type: 'integer' },
            { header: 'Revenue',        key: 'total',  width: 18, type: 'currency' },
            { header: 'Share %',        key: 'share',  width: 12, type: 'percent' },
          ],
          data: byPayment.map(p => ({
            method: p.method.replace(/_/g, ' '),
            count:  p.count,
            total:  p.total,
            share:  totalRevenue > 0 ? parseFloat(((p.total / totalRevenue) * 100).toFixed(1)) : 0,
          })),
          totals: { method: 'TOTAL', count: byPayment.reduce((s, p) => s + p.count, 0), total: byPayment.reduce((s, p) => s + p.total, 0), share: 100 },
        },
        // 9 – Hourly Distribution
        {
          name:    'Hourly Distribution',
          columns: [
            { header: 'Hour',         key: 'label', width: 10 },
            { header: 'Transactions', key: 'count', width: 16, type: 'integer' },
            { header: 'Revenue',      key: 'total', width: 16, type: 'currency' },
            { header: 'Avg Sale',     key: 'avg',   width: 14, type: 'currency' },
          ],
          data:   hourly.filter(h => h.count > 0),
          totals: { label: 'TOTAL', count: hourly.reduce((s, h) => s + h.count, 0), total: hourly.reduce((s, h) => s + h.total, 0) },
        },
        // 10 – Day of Week
        {
          name:    'Day of Week',
          columns: [
            { header: 'Day',          key: 'label', width: 14 },
            { header: 'Transactions', key: 'count', width: 16, type: 'integer' },
            { header: 'Revenue',      key: 'total', width: 16, type: 'currency' },
            { header: 'Avg Sale',     key: 'avg',   width: 14, type: 'currency' },
          ],
          data:   byDayOfWeek,
          totals: { label: 'TOTAL', count: byDayOfWeek.reduce((s, d) => s + d.count, 0), total: byDayOfWeek.reduce((s, d) => s + d.total, 0) },
        },
        // 11 – Top Customers
        {
          name:    'Top Customers',
          kpis: [
            { label: 'Unique Customers',  value: String(topCustomers.length) },
            { label: 'Customer Revenue',  value: `FJD ${topCustomers.reduce((s, c) => s + c.total_spent, 0).toFixed(2)}` },
            { label: 'Top Customer',      value: topCustomers[0]?.full_name ?? '—' },
            { label: 'Avg Customer Spend',value: topCustomers.length ? `FJD ${(topCustomers.reduce((s, c) => s + c.total_spent, 0) / topCustomers.length).toFixed(2)}` : '—' },
          ],
          columns: [
            { header: 'Customer',        key: 'full_name',      width: 26 },
            { header: 'Email',           key: 'email',          width: 28 },
            { header: 'Transactions',    key: 'tx_count',       width: 16, type: 'integer' },
            { header: 'Total Spent',     key: 'total_spent',    width: 16, type: 'currency' },
            { header: 'Avg Spend',       key: 'avg_spend',      width: 14, type: 'currency' },
            { header: 'Loyalty Points',  key: 'loyalty_points', width: 16, type: 'integer' },
          ],
          data:   topCustomers as unknown as Record<string, unknown>[],
          totals: {
            full_name:   'TOTALS',
            tx_count:    topCustomers.reduce((s, c) => s + c.tx_count, 0),
            total_spent: topCustomers.reduce((s, c) => s + c.total_spent, 0),
          },
        },
        // 12 – Refunds
        {
          name:    'Refunds',
          kpis: [
            { label: 'Total Refunded',  value: `FJD ${refundsTotal.toFixed(2)}` },
            { label: 'Refund Count',    value: String(refundDetails.length) },
            { label: 'Avg Refund',      value: refundDetails.length ? `FJD ${(refundsTotal / refundDetails.length).toFixed(2)}` : '—' },
            { label: 'Refund Rate',     value: totalTx > 0 ? `${((refundDetails.length / totalTx) * 100).toFixed(1)}%` : '0%' },
          ],
          columns: [
            { header: 'Sale ID',    key: 'sale_id',    width: 12 },
            { header: 'Date',       key: 'created_at', width: 22 },
            { header: 'Processed by', key: 'user_name', width: 22 },
            { header: 'Amount',     key: 'amount',     width: 14, type: 'currency' },
            { header: 'Reason',     key: 'reason',     width: 36 },
          ],
          data:   refundDetails.map(r => ({ ...r, created_at: formatDateTime(r.created_at) })),
          totals: { sale_id: 'TOTAL', amount: refundDetails.reduce((s, r) => s + r.amount, 0) },
        },
      ],
    })
    setExportOpen(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${totalTx} transactions · ${formatCurrency(totalRevenue)}`}
          </p>
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
                className="bg-white border border-blue-100 rounded-xl shadow-2xl overflow-hidden w-60"
              >
                <button
                  onClick={exportFullReport}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 text-left whitespace-nowrap border-b border-blue-100"
                >
                  <Download size={14} className="text-blue-500 shrink-0" /> Full Report (12 sheets)
                </button>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Individual sheets
                </div>
                {[
                  { label: 'Detailed Transactions', onClick: () => { exportToExcel({ ...xlBase, filename: `sales-detailed-${dateFrom}-${dateTo}`, reportTitle: 'Detailed Sales Transactions',
                    sheets: [{ name: 'Detailed Sales', kpis: [{ label: 'Total Revenue', value: `FJD ${totalRevenue.toFixed(2)}` }, { label: 'Transactions', value: String(totalTx) }, { label: 'Avg. Sale', value: `FJD ${avgTx.toFixed(2)}` }, { label: 'Total Discounts', value: `FJD ${totalDiscount.toFixed(2)}` }],
                      columns: [{ header: 'Date', key: 'date', width: 14 }, { header: 'Cashier', key: 'cashier', width: 22 }, { header: 'Payment Method', key: 'payment', width: 20 }, { header: 'Subtotal', key: 'subtotal', width: 14, type: 'currency' as const }, { header: 'Discount', key: 'discount', width: 14, type: 'currency' as const }, { header: 'Tax', key: 'tax', width: 12, type: 'currency' as const }, { header: 'Total', key: 'total', width: 14, type: 'currency' as const }],
                      data: sales.map(s => ({ date: s.created_at.slice(0, 10), cashier: s.user?.full_name ?? '', payment: s.payment_method.replace(/_/g, ' '), subtotal: s.subtotal, discount: s.discount_amount, tax: s.tax_amount, total: s.total })),
                      totals: { date: 'TOTALS', subtotal: sales.reduce((s, r) => s + r.subtotal, 0), discount: sales.reduce((s, r) => s + r.discount_amount, 0), tax: sales.reduce((s, r) => s + r.tax_amount, 0), total: sales.reduce((s, r) => s + r.total, 0) } }] }) ; setExportOpen(false) } },
                  { label: 'Performance Summary', onClick: () => { exportToExcel({ ...xlBase, filename: `sales-summary-${dateFrom}-${dateTo}`, reportTitle: 'Sales Performance Summary',
                    sheets: [{ name: 'Performance Summary', kpis: [{ label: 'Gross Sales', value: `FJD ${totalRevenue.toFixed(2)}` }, { label: 'Net Sales', value: `FJD ${netSales.toFixed(2)}` }, { label: 'Gross Profit', value: totalCOGS > 0 ? `FJD ${grossProfit.toFixed(2)}` : '—' }, { label: 'Transactions', value: String(totalTx) }],
                      columns: [{ header: 'Metric', key: 'metric', width: 40 }, { header: 'Value', key: 'value', width: 24, align: 'right' as const }],
                      data: [{ _section: true, metric: '◆  REVENUE' }, { metric: 'Gross Sales (incl. tax)', value: `FJD ${totalRevenue.toFixed(2)}` }, { metric: 'Sales EX Tax', value: `FJD ${totalExTax.toFixed(2)}` }, { metric: 'Refunds', value: `FJD ${refundsTotal.toFixed(2)}` }, { metric: 'Net Sales', value: `FJD ${netSales.toFixed(2)}` }, { _section: true, metric: '◆  PROFITABILITY' }, { metric: 'COGS', value: totalCOGS > 0 ? `FJD ${totalCOGS.toFixed(2)}` : 'N/A' }, { metric: 'Gross Profit', value: totalCOGS > 0 ? `FJD ${grossProfit.toFixed(2)}` : 'N/A' }, { metric: 'Gross Margin %', value: totalCOGS > 0 ? `${marginPct.toFixed(1)}%` : 'N/A' }, { _section: true, metric: '◆  DISCOUNTS & TAX' }, { metric: 'Total Discounts', value: `FJD ${totalDiscount.toFixed(2)}` }, { metric: 'Tax Collected', value: `FJD ${totalTax.toFixed(2)}` }, { _section: true, metric: '◆  OPERATIONS' }, { metric: 'Total Transactions', value: String(totalTx) }, { metric: 'Average Sale Value', value: `FJD ${avgTx.toFixed(2)}` }] }] }) ; setExportOpen(false) } },
                  { label: 'Daily Breakdown',      onClick: () => { exportToExcel({ ...xlBase, filename: `daily-${dateFrom}-${dateTo}`, reportTitle: 'Daily Sales Breakdown', sheets: [{ name: 'Daily', columns: [{ header: 'Date', key: 'date', width: 14 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Items Sold', key: 'items', width: 14, type: 'integer' as const }, { header: 'Subtotal', key: 'subtotal', width: 14, type: 'currency' as const }, { header: 'Discounts', key: 'discount', width: 14, type: 'currency' as const }, { header: 'Tax', key: 'tax', width: 12, type: 'currency' as const }, { header: 'Total', key: 'total', width: 14, type: 'currency' as const }, { header: 'Avg Sale', key: 'avg', width: 14, type: 'currency' as const }], data: dailySummary, totals: { date: 'TOTALS', count: dailySummary.reduce((s, d) => s + d.count, 0), items: dailySummary.reduce((s, d) => s + d.items, 0), subtotal: dailySummary.reduce((s, d) => s + d.subtotal, 0), discount: dailySummary.reduce((s, d) => s + d.discount, 0), tax: dailySummary.reduce((s, d) => s + d.tax, 0), total: dailySummary.reduce((s, d) => s + d.total, 0) } }] }) ; setExportOpen(false) } },
                  { label: 'Top Customers',        onClick: () => { exportToExcel({ ...xlBase, filename: `customers-${dateFrom}-${dateTo}`, reportTitle: 'Top Customers by Spend', sheets: [{ name: 'Customers', columns: [{ header: 'Customer', key: 'full_name', width: 26 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Transactions', key: 'tx_count', width: 16, type: 'integer' as const }, { header: 'Total Spent', key: 'total_spent', width: 16, type: 'currency' as const }, { header: 'Avg Spend', key: 'avg_spend', width: 14, type: 'currency' as const }, { header: 'Loyalty Points', key: 'loyalty_points', width: 16, type: 'integer' as const }], data: topCustomers as unknown as Record<string, unknown>[], totals: { full_name: 'TOTALS', tx_count: topCustomers.reduce((s, c) => s + c.tx_count, 0), total_spent: topCustomers.reduce((s, c) => s + c.total_spent, 0) } }] }) ; setExportOpen(false) } },
                  { label: 'Refunds',              onClick: () => { exportToExcel({ ...xlBase, filename: `refunds-${dateFrom}-${dateTo}`, reportTitle: 'Refund Analysis', sheets: [{ name: 'Refunds', columns: [{ header: 'Sale ID', key: 'sale_id', width: 12 }, { header: 'Date', key: 'created_at', width: 22 }, { header: 'Processed by', key: 'user_name', width: 22 }, { header: 'Amount', key: 'amount', width: 14, type: 'currency' as const }, { header: 'Reason', key: 'reason', width: 36 }], data: refundDetails.map(r => ({ ...r, created_at: formatDateTime(r.created_at) })), totals: { sale_id: 'TOTAL', amount: refundDetails.reduce((s, r) => s + r.amount, 0) } }] }) ; setExportOpen(false) } },
                ].map(item => (
                  <button key={item.label} onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 text-left whitespace-nowrap">
                    <FileText size={13} className="text-slate-400 shrink-0" /> {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
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

      {/* ════════════════════════════════════════════════════════════════
          SUMMARY
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Gross Sales (incl. tax)" value={formatCurrency(totalRevenue)} sub={`${totalTx} transactions`} />
            <MetricCard label="Sales EX Tax"   value={formatCurrency(totalExTax)} />
            <MetricCard label="Avg. Sale"      value={formatCurrency(avgTx)} />
            <MetricCard label="Net Sales"      value={formatCurrency(netSales)} sub={refundsTotal > 0 ? `after ${formatCurrency(refundsTotal)} refunds` : 'no refunds'} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="COGS"           value={totalCOGS > 0 ? formatCurrency(totalCOGS) : '—'} sub="cost of goods sold" />
            <MetricCard label="Gross Profit"   value={totalCOGS > 0 ? formatCurrency(grossProfit) : '—'} sub="sales EX – COGS" />
            <MetricCard label="Margin %"       value={totalCOGS > 0 ? `${marginPct.toFixed(1)}%` : '—'} sub="gross profit / sales EX" />
            <MetricCard label="Total Discount" value={formatCurrency(totalDiscount)} sub={`Tax: ${formatCurrency(totalTax)}`} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Refunds"         value={formatCurrency(refundsTotal)} sub={`${refundDetails.length} transactions`} />
            <MetricCard label="Discount Rate"   value={totalTx > 0 ? `${((sales.filter(s => s.discount_amount > 0).length / totalTx) * 100).toFixed(1)}%` : '0%'} sub="% of sales with discounts" />
            <MetricCard label="Unique Customers" value={String(topCustomers.length)} sub="purchasing in period" />
            <MetricCard label="Items Sold"      value={String(sales.reduce((s, r) => s + r.items.reduce((is, i) => is + i.quantity, 0), 0))} sub="total units" />
          </div>
          {trend.labels.length > 1 ? (
            <div className="bg-white border border-blue-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-600 mb-3">Sales Trend</h3>
              <div className="h-64">
                <Line data={{ labels: trend.labels, datasets: [{ data: trend.data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1' }] }} options={CHART_OPTIONS} />
              </div>
            </div>
          ) : (
            <EmptyState message="Select a date range spanning multiple days to see the sales trend." />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DAILY BREAKDOWN
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `daily-${dateFrom}-${dateTo}`, reportTitle: 'Daily Sales Breakdown',
              sheets: [{ name: 'Daily Breakdown', kpis: [{ label: 'Days Active', value: String(dailySummary.filter(d => d.count > 0).length) }, { label: 'Best Day Revenue', value: dailySummary.length ? `FJD ${Math.max(...dailySummary.map(d => d.total)).toFixed(2)}` : '—' }, { label: 'Total Revenue', value: `FJD ${totalRevenue.toFixed(2)}` }, { label: 'Avg Daily Revenue', value: dailySummary.length ? `FJD ${(totalRevenue / dailySummary.length).toFixed(2)}` : '—' }],
                columns: [{ header: 'Date', key: 'date', width: 14 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Items Sold', key: 'items', width: 14, type: 'integer' as const }, { header: 'Subtotal', key: 'subtotal', width: 14, type: 'currency' as const }, { header: 'Discounts', key: 'discount', width: 14, type: 'currency' as const }, { header: 'Tax', key: 'tax', width: 12, type: 'currency' as const }, { header: 'Total', key: 'total', width: 14, type: 'currency' as const }, { header: 'Avg Sale', key: 'avg', width: 14, type: 'currency' as const }],
                data: dailySummary, totals: { date: 'TOTALS', count: dailySummary.reduce((s, d) => s + d.count, 0), items: dailySummary.reduce((s, d) => s + d.items, 0), subtotal: dailySummary.reduce((s, d) => s + d.subtotal, 0), discount: dailySummary.reduce((s, d) => s + d.discount, 0), tax: dailySummary.reduce((s, d) => s + d.tax, 0), total: dailySummary.reduce((s, d) => s + d.total, 0) } }] })} />
          </div>
          {dailySummary.length > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100">
                  {['Date','Transactions','Items Sold','Subtotal','Discounts','Tax','Total','Avg Sale'].map(h => (
                    <th key={h} className={cn('px-4 py-3 text-slate-500 font-medium', h === 'Date' ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {dailySummary.map((d, i) => (
                    <tr key={i} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{d.date}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{d.count}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{d.items}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(d.subtotal)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{formatCurrency(d.discount)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{formatCurrency(d.tax)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(d.total)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{formatCurrency(d.avg)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                    <td className="px-4 py-2.5 text-slate-900">TOTALS</td>
                    <td className="px-4 py-2.5 text-right">{dailySummary.reduce((s, d) => s + d.count, 0)}</td>
                    <td className="px-4 py-2.5 text-right">{dailySummary.reduce((s, d) => s + d.items, 0)}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(dailySummary.reduce((s, d) => s + d.subtotal, 0))}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(dailySummary.reduce((s, d) => s + d.discount, 0))}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(dailySummary.reduce((s, d) => s + d.tax, 0))}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{formatCurrency(dailySummary.reduce((s, d) => s + d.total, 0))}</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PRODUCTS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `top-products-${dateFrom}-${dateTo}`, reportTitle: 'Top Products by Revenue',
              sheets: [{ name: 'Top Products', kpis: [{ label: 'Products Sold', value: String(byProduct.length) }, { label: 'Total Units', value: String(byProduct.reduce((s,p) => s+p.qty, 0)) }, { label: 'Total Revenue', value: `FJD ${byProduct.reduce((s,p) => s+p.total, 0).toFixed(2)}` }, { label: 'Top Product', value: byProduct[0]?.name ?? '—' }],
                columns: [{ header: 'Rank', key: 'rank', width: 8, type: 'integer' as const, align: 'center' as const }, { header: 'Product', key: 'name', width: 36 }, { header: 'Qty Sold', key: 'qty', width: 14, type: 'integer' as const }, { header: 'Revenue', key: 'total', width: 16, type: 'currency' as const }],
                data: byProduct.map((p, i) => ({ rank: i+1, name: p.name, qty: p.qty, total: p.total })), totals: { name: 'TOTAL', qty: byProduct.reduce((s,p) => s+p.qty, 0), total: byProduct.reduce((s,p) => s+p.total, 0) } }] })} />
          </div>
          {byProduct.length > 0 ? (
            <>
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-600 mb-3">Top Products by Revenue</h3>
                <div className="h-64">
                  <Bar data={{ labels: byProduct.slice(0,10).map(p => p.name.length > 20 ? p.name.slice(0,18)+'…' : p.name), datasets: [{ data: byProduct.slice(0,10).map(p => p.total), backgroundColor: CHART_COLORS }] }} options={CHART_OPTIONS} />
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

      {/* ════════════════════════════════════════════════════════════════
          MARGIN ANALYSIS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'margin' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Total Revenue"  value={formatCurrency(byMargin.reduce((s,p)=>s+p.revenue,0))} />
            <MetricCard label="Total COGS"     value={formatCurrency(byMargin.reduce((s,p)=>s+p.cost,0))} sub="cost of goods" />
            <MetricCard label="Gross Profit"   value={formatCurrency(byMargin.reduce((s,p)=>s+p.profit,0))} />
            <MetricCard label="Blended Margin" value={byMargin.reduce((s,p)=>s+p.revenue,0) > 0 ? `${((byMargin.reduce((s,p)=>s+p.profit,0)/byMargin.reduce((s,p)=>s+p.revenue,0))*100).toFixed(1)}%` : '—'} sub="gross / revenue" />
          </div>
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `margin-${dateFrom}-${dateTo}`, reportTitle: 'Product Margin Analysis',
              sheets: [{ name: 'Product Margin', kpis: [{ label: 'Total Revenue', value: `FJD ${byMargin.reduce((s,p)=>s+p.revenue,0).toFixed(2)}` }, { label: 'Total COGS', value: `FJD ${byMargin.reduce((s,p)=>s+p.cost,0).toFixed(2)}` }, { label: 'Gross Profit', value: `FJD ${byMargin.reduce((s,p)=>s+p.profit,0).toFixed(2)}` }, { label: 'Products', value: String(byMargin.length) }],
                columns: [{ header: 'Product', key: 'name', width: 34 }, { header: 'Qty Sold', key: 'qty', width: 12, type: 'integer' as const }, { header: 'Revenue', key: 'revenue', width: 16, type: 'currency' as const }, { header: 'COGS', key: 'cost', width: 16, type: 'currency' as const }, { header: 'Gross Profit', key: 'profit', width: 16, type: 'currency' as const }, { header: 'Margin %', key: 'margin', width: 12, type: 'percent' as const }],
                data: byMargin, totals: { name: 'TOTAL', qty: byMargin.reduce((s,p)=>s+p.qty,0), revenue: byMargin.reduce((s,p)=>s+p.revenue,0), cost: byMargin.reduce((s,p)=>s+p.cost,0), profit: byMargin.reduce((s,p)=>s+p.profit,0) } }] })} />
          </div>
          {byMargin.filter(p => p.cost > 0).length > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100">
                  {['Product','Qty','Revenue','COGS','Gross Profit','Margin %'].map((h, i) => (
                    <th key={h} className={cn('px-4 py-3 text-slate-500 font-medium', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{byMargin.map((p, i) => (
                  <tr key={i} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                    <td className="px-4 py-2.5 text-slate-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(p.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{p.cost > 0 ? formatCurrency(p.cost) : <span className="text-slate-300">No cost</span>}</td>
                    <td className={cn('px-4 py-2.5 text-right font-medium', p.profit > 0 ? 'text-green-600' : p.profit < 0 ? 'text-red-500' : 'text-slate-400')}>
                      {p.cost > 0 ? formatCurrency(p.profit) : '—'}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold', p.margin >= 30 ? 'text-green-600' : p.margin >= 10 ? 'text-amber-600' : p.cost > 0 ? 'text-red-500' : 'text-slate-300')}>
                      {p.cost > 0 ? `${p.margin.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No cost data found. Add cost prices to your products to see margin analysis." />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CATEGORIES
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `categories-${dateFrom}-${dateTo}`, reportTitle: 'Sales by Category',
              sheets: [{ name: 'By Category', columns: [{ header: 'Category', key: 'name', width: 28 }, { header: 'Revenue', key: 'total', width: 18, type: 'currency' as const }, { header: 'Share %', key: 'share', width: 12, type: 'percent' as const }],
                data: byCategory.map(c => ({ name: c.name, total: c.total, share: totalRevenue > 0 ? parseFloat(((c.total/totalRevenue)*100).toFixed(1)) : 0 })), totals: { name: 'TOTAL', total: byCategory.reduce((s,c)=>s+c.total,0), share: 100 } }] })} />
          </div>
          {byCategory.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{ labels: byCategory.map(c => c.name), datasets: [{ data: byCategory.map(c => c.total), backgroundColor: CHART_COLORS, borderWidth: 0 }] }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
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

      {/* ════════════════════════════════════════════════════════════════
          STAFF
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `staff-${dateFrom}-${dateTo}`, reportTitle: 'Staff Sales Performance',
              sheets: [{ name: 'Staff Performance', kpis: [{ label: 'Staff Members', value: String(byStaff.length) }, { label: 'Total Transactions', value: String(byStaff.reduce((s,r)=>s+r.count,0)) }, { label: 'Total Revenue', value: `FJD ${byStaff.reduce((s,r)=>s+r.total,0).toFixed(2)}` }, { label: 'Top Performer', value: byStaff[0]?.name ?? '—' }],
                columns: [{ header: 'Cashier', key: 'name', width: 26 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Avg Sale', key: 'avg', width: 14, type: 'currency' as const }, { header: 'Discounts Given', key: 'discount', width: 18, type: 'currency' as const }, { header: 'Revenue', key: 'total', width: 16, type: 'currency' as const }],
                data: byStaff, totals: { name: 'TOTALS', count: byStaff.reduce((s,r)=>s+r.count,0), discount: byStaff.reduce((s,r)=>s+r.discount,0), total: byStaff.reduce((s,r)=>s+r.total,0) } }] })} />
          </div>
          {byStaff.length > 0 ? (
            <>
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <div className="h-64">
                  <Bar data={{ labels: byStaff.map(s => s.name), datasets: [{ data: byStaff.map(s => s.total), backgroundColor: CHART_COLORS }] }} options={CHART_OPTIONS} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Cashier</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Avg Sale</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Discounts Given</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byStaff.map((s, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.count}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(s.avg)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(s.discount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(s.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{totalRevenue ? ((s.total/totalRevenue)*100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DISCOUNT ANALYSIS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'discounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Total Discounts"  value={formatCurrency(totalDiscount)} />
            <MetricCard label="Sales w/ Discount" value={String(sales.filter(s=>s.discount_amount>0).length)} sub={`of ${totalTx} total`} />
            <MetricCard label="Discount Rate"    value={totalTx > 0 ? `${((sales.filter(s=>s.discount_amount>0).length/totalTx)*100).toFixed(1)}%` : '0%'} sub="% of sales" />
            <MetricCard label="Avg Discount"     value={sales.filter(s=>s.discount_amount>0).length > 0 ? formatCurrency(totalDiscount/sales.filter(s=>s.discount_amount>0).length) : formatCurrency(0)} sub="per discounted sale" />
          </div>
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `discounts-${dateFrom}-${dateTo}`, reportTitle: 'Discount Analysis by Staff',
              sheets: [{ name: 'Discount Analysis', kpis: [{ label: 'Total Discounts', value: `FJD ${totalDiscount.toFixed(2)}` }, { label: 'Discounted Sales', value: String(sales.filter(s=>s.discount_amount>0).length) }, { label: 'Discount Rate', value: totalTx > 0 ? `${((sales.filter(s=>s.discount_amount>0).length/totalTx)*100).toFixed(1)}%` : '0%' }, { label: 'Avg Discount', value: sales.filter(s=>s.discount_amount>0).length > 0 ? `FJD ${(totalDiscount/sales.filter(s=>s.discount_amount>0).length).toFixed(2)}` : 'FJD 0.00' }],
                columns: [{ header: 'Cashier', key: 'name', width: 26 }, { header: 'Total Sales', key: 'count', width: 14, type: 'integer' as const }, { header: 'Sales w/ Discount', key: 'with_discount', width: 20, type: 'integer' as const }, { header: 'Discount Rate %', key: 'discount_rate', width: 18, type: 'percent' as const }, { header: 'Total Discounts', key: 'discount_total', width: 18, type: 'currency' as const }, { header: 'Avg Discount', key: 'avg_discount', width: 16, type: 'currency' as const }],
                data: byDiscount, totals: { name: 'TOTALS', count: byDiscount.reduce((s,r)=>s+r.count,0), with_discount: byDiscount.reduce((s,r)=>s+r.with_discount,0), discount_total: byDiscount.reduce((s,r)=>s+r.discount_total,0) } }] })} />
          </div>
          {byDiscount.length > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100">
                  {['Cashier','Total Sales','Sales w/ Discount','Discount Rate','Total Discounts','Avg Discount / Sale'].map((h,i) => (
                    <th key={h} className={cn('px-4 py-3 text-slate-500 font-medium', i===0 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{byDiscount.map((s, i) => (
                  <tr key={i} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{s.count}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{s.with_discount}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', s.discount_rate > 50 ? 'text-red-500' : s.discount_rate > 20 ? 'text-amber-600' : 'text-green-600')}>
                      {s.discount_rate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(s.discount_total)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(s.avg_discount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CUSTOMERS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'customers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Unique Customers"   value={String(topCustomers.length)} sub="in period" />
            <MetricCard label="Customer Revenue"   value={formatCurrency(topCustomers.reduce((s,c)=>s+c.total_spent,0))} />
            <MetricCard label="Avg Customer Spend" value={topCustomers.length ? formatCurrency(topCustomers.reduce((s,c)=>s+c.total_spent,0)/topCustomers.length) : formatCurrency(0)} />
            <MetricCard label="Top Customer"       value={topCustomers[0]?.full_name ?? '—'} sub={topCustomers[0] ? formatCurrency(topCustomers[0].total_spent) : ''} />
          </div>
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `customers-${dateFrom}-${dateTo}`, reportTitle: 'Top Customers by Spend',
              sheets: [{ name: 'Top Customers', kpis: [{ label: 'Unique Customers', value: String(topCustomers.length) }, { label: 'Customer Revenue', value: `FJD ${topCustomers.reduce((s,c)=>s+c.total_spent,0).toFixed(2)}` }, { label: 'Top Customer', value: topCustomers[0]?.full_name ?? '—' }, { label: 'Avg Spend', value: topCustomers.length ? `FJD ${(topCustomers.reduce((s,c)=>s+c.total_spent,0)/topCustomers.length).toFixed(2)}` : '—' }],
                columns: [{ header: 'Customer', key: 'full_name', width: 26 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Transactions', key: 'tx_count', width: 16, type: 'integer' as const }, { header: 'Total Spent', key: 'total_spent', width: 16, type: 'currency' as const }, { header: 'Avg Spend', key: 'avg_spend', width: 14, type: 'currency' as const }, { header: 'Loyalty Points', key: 'loyalty_points', width: 16, type: 'integer' as const }],
                data: topCustomers as unknown as Record<string, unknown>[], totals: { full_name: 'TOTALS', tx_count: topCustomers.reduce((s,c)=>s+c.tx_count,0), total_spent: topCustomers.reduce((s,c)=>s+c.total_spent,0) } }] })} />
          </div>
          {topCustomers.length > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Total Spent</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Avg Spend</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Loyalty Pts</th>
                </tr></thead>
                <tbody>{topCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.tx_count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(c.total_spent)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(c.avg_spend)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{c.loyalty_points.toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState message="No customer purchases found for this period." />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PAYMENTS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `payments-${dateFrom}-${dateTo}`, reportTitle: 'Payment Method Breakdown',
              sheets: [{ name: 'Payment Breakdown', columns: [{ header: 'Payment Method', key: 'method', width: 22 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Revenue', key: 'total', width: 18, type: 'currency' as const }, { header: 'Share %', key: 'share', width: 12, type: 'percent' as const }],
                data: byPayment.map(p => ({ method: p.method.replace(/_/g,' '), count: p.count, total: p.total, share: totalRevenue > 0 ? parseFloat(((p.total/totalRevenue)*100).toFixed(1)) : 0 })), totals: { method: 'TOTAL', count: byPayment.reduce((s,p)=>s+p.count,0), total: byPayment.reduce((s,p)=>s+p.total,0), share: 100 } }] })} />
          </div>
          {byPayment.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center justify-center">
                <div className="w-72">
                  <Doughnut data={{ labels: byPayment.map(p => p.method.replace('_',' ')), datasets: [{ data: byPayment.map(p => p.total), backgroundColor: CHART_COLORS, borderWidth: 0 }] }} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden self-start">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Method</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Share</th>
                  </tr></thead>
                  <tbody>{byPayment.map((p, i) => (
                    <tr key={i} className="border-b border-blue-200/50">
                      <td className="px-4 py-3 capitalize text-slate-900">{p.method.replace('_',' ')}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{p.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{totalRevenue ? ((p.total/totalRevenue)*100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          HOURLY
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'hourly' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `hourly-${dateFrom}-${dateTo}`, reportTitle: 'Hourly Sales Distribution',
              sheets: [{ name: 'Hourly', columns: [{ header: 'Hour', key: 'label', width: 10 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Revenue', key: 'total', width: 16, type: 'currency' as const }, { header: 'Avg Sale', key: 'avg', width: 14, type: 'currency' as const }],
                data: hourly.filter(h => h.count > 0), totals: { label: 'TOTAL', count: hourly.reduce((s,h)=>s+h.count,0), total: hourly.reduce((s,h)=>s+h.total,0) } }] })} />
          </div>
          {sales.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-600 mb-3">Revenue by Hour of Day</h3>
                <div className="h-64">
                  <Bar data={{ labels: hourly.map(h => h.label), datasets: [{ data: hourly.map(h => h.total), backgroundColor: '#6366f1', borderRadius: 4 }] }} options={CHART_OPTIONS} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Hour</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Avg Sale</th>
                  </tr></thead>
                  <tbody>{hourly.filter(h => h.count > 0).map((h, i) => (
                    <tr key={i} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5 text-slate-600">{h.label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{h.count}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatCurrency(h.total)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{formatCurrency(h.avg)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DAY OF WEEK
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'dayofweek' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `day-of-week-${dateFrom}-${dateTo}`, reportTitle: 'Sales by Day of Week',
              sheets: [{ name: 'Day of Week', columns: [{ header: 'Day', key: 'label', width: 14 }, { header: 'Transactions', key: 'count', width: 16, type: 'integer' as const }, { header: 'Revenue', key: 'total', width: 16, type: 'currency' as const }, { header: 'Avg Sale', key: 'avg', width: 14, type: 'currency' as const }],
                data: byDayOfWeek, totals: { label: 'TOTAL', count: byDayOfWeek.reduce((s,d)=>s+d.count,0), total: byDayOfWeek.reduce((s,d)=>s+d.total,0) } }] })} />
          </div>
          {sales.length > 0 ? (
            <>
              <div className="bg-white border border-blue-100 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-600 mb-3">Revenue by Day of Week</h3>
                <div className="h-64">
                  <Bar data={{ labels: byDayOfWeek.map(d => d.short), datasets: [{ data: byDayOfWeek.map(d => d.total), backgroundColor: CHART_COLORS.slice(0, 7), borderRadius: 4 }] }} options={CHART_OPTIONS} />
                </div>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-blue-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Day</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Transactions</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Avg Sale</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">% of Total</th>
                  </tr></thead>
                  <tbody>{byDayOfWeek.map((d, i) => (
                    <tr key={i} className={cn('border-b border-blue-200/50', d.count === 0 ? 'opacity-40' : 'hover:bg-blue-50/30')}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{d.label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{d.count}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(d.total)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{d.count > 0 ? formatCurrency(d.avg) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{totalRevenue && d.total > 0 ? ((d.total/totalRevenue)*100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : <EmptyState />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          REFUNDS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'refunds' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Total Refunded"  value={formatCurrency(refundsTotal)} />
            <MetricCard label="Refund Count"    value={String(refundDetails.length)} />
            <MetricCard label="Avg Refund"      value={refundDetails.length ? formatCurrency(refundsTotal/refundDetails.length) : formatCurrency(0)} />
            <MetricCard label="Refund Rate"     value={totalTx > 0 ? `${((refundDetails.length/totalTx)*100).toFixed(1)}%` : '0%'} sub="of total transactions" />
          </div>
          <div className="flex justify-end">
            <TabExportBtn onClick={() => exportToExcel({ ...xlBase, filename: `refunds-${dateFrom}-${dateTo}`, reportTitle: 'Refund Analysis',
              sheets: [{ name: 'Refunds', kpis: [{ label: 'Total Refunded', value: `FJD ${refundsTotal.toFixed(2)}` }, { label: 'Refund Count', value: String(refundDetails.length) }, { label: 'Avg Refund', value: refundDetails.length ? `FJD ${(refundsTotal/refundDetails.length).toFixed(2)}` : '—' }, { label: 'Refund Rate', value: totalTx > 0 ? `${((refundDetails.length/totalTx)*100).toFixed(1)}%` : '0%' }],
                columns: [{ header: 'Sale ID', key: 'sale_id', width: 12 }, { header: 'Date', key: 'created_at', width: 22 }, { header: 'Processed by', key: 'user_name', width: 22 }, { header: 'Amount', key: 'amount', width: 14, type: 'currency' as const }, { header: 'Reason', key: 'reason', width: 36 }],
                data: refundDetails.map(r => ({ ...r, created_at: formatDateTime(r.created_at) })), totals: { sale_id: 'TOTAL', amount: refundDetails.reduce((s,r)=>s+r.amount,0) } }] })} />
          </div>
          {refundDetails.length > 0 ? (
            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Sale ID</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Processed By</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Reason</th>
                </tr></thead>
                <tbody>{refundDetails.map((r, i) => (
                  <tr key={i} className="border-b border-blue-200/50 hover:bg-red-50/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-500">{r.sale_id}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.user_name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{r.reason}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState message="No refunds recorded in this period." />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Z / X REPORT
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'zreport' && zData && (
        <div className="space-y-4">
          <div className="bg-white border border-blue-100 rounded-xl p-5 max-w-md">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">End of Day Report</h3>
            <p className="text-xs text-slate-500 mb-4">X-Report is a snapshot. Z-Report closes the day and records the summary.</p>
            <div className="flex gap-3">
              <button onClick={() => setZType('X')} className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-slate-900 text-sm font-medium rounded-lg border border-blue-200 transition-colors">Print X-Report</button>
              <button onClick={() => setZType('Z')} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Print Z-Report</button>
            </div>
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
