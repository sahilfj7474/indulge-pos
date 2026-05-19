import { createClient } from '@/lib/supabase/client'
import { localDayStart, localDayEnd } from '@/lib/utils'

export interface SaleRow {
  id: string
  created_at: string
  total: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  payment_method: string
  status: string
  user_id: string
  customer_id: string | null
  items: { product_id: string; quantity: number; total: number; product: { name: string; category_id: string | null; cost: number | null; category: { name: string } | null } }[]
  user: { full_name: string }
}

export async function fetchSalesForReport(
  locationId: string,   // '' = all stores
  dateFrom: string,
  dateTo: string
): Promise<SaleRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('sales')
    .select(`
      id, created_at, total, subtotal, discount_amount, tax_amount,
      payment_method, status, user_id, customer_id,
      user:users(full_name),
      items:sale_items(product_id, quantity, total, product:products(name, category_id, cost, category:categories(name)))
    `)
    .eq('status', 'completed')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
    .order('created_at')
    .limit(2000)
  if (locationId) query = query.eq('location_id', locationId)
  const { data } = await query
  return (data ?? []) as unknown as SaleRow[]
}

export function aggregateSalesTrend(sales: SaleRow[]) {
  const map = new Map<string, number>()
  for (const s of sales) {
    const day = s.created_at.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + s.total)
  }
  const labels = Array.from(map.keys()).sort()
  return { labels, data: labels.map(l => parseFloat(map.get(l)!.toFixed(2))) }
}

export function aggregateByCategory(sales: SaleRow[]) {
  const map = new Map<string, number>()
  for (const s of sales) {
    for (const item of s.items) {
      const cat = item.product?.category?.name ?? 'Uncategorised'
      map.set(cat, (map.get(cat) ?? 0) + item.total)
    }
  }
  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
}

export function aggregateByProduct(sales: SaleRow[], limit = 10) {
  const map = new Map<string, { qty: number; total: number }>()
  for (const s of sales) {
    for (const item of s.items) {
      const name = item.product?.name ?? 'Unknown'
      const existing = map.get(name) ?? { qty: 0, total: 0 }
      map.set(name, { qty: existing.qty + item.quantity, total: existing.total + item.total })
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, qty: v.qty, total: parseFloat(v.total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function aggregateByStaff(sales: SaleRow[]) {
  const map = new Map<string, { count: number; total: number; discount: number }>()
  for (const s of sales) {
    const name = (s.user as unknown as { full_name: string })?.full_name ?? 'Unknown'
    const existing = map.get(name) ?? { count: 0, total: 0, discount: 0 }
    map.set(name, { count: existing.count + 1, total: existing.total + s.total, discount: existing.discount + s.discount_amount })
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, count: v.count, total: parseFloat(v.total.toFixed(2)), discount: parseFloat(v.discount.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
}

export function aggregateByPayment(sales: SaleRow[]) {
  const map = new Map<string, number>()
  for (const s of sales) {
    map.set(s.payment_method, (map.get(s.payment_method) ?? 0) + s.total)
  }
  return Array.from(map.entries())
    .map(([method, total]) => ({ method, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
}

export function aggregateHourly(sales: SaleRow[]) {
  const map = new Map<number, number>()
  for (let h = 0; h < 24; h++) map.set(h, 0)
  for (const s of sales) {
    const hour = new Date(s.created_at).getHours()
    map.set(hour, (map.get(hour) ?? 0) + s.total)
  }
  return Array.from(map.entries())
    .map(([hour, total]) => ({ hour, label: `${hour.toString().padStart(2, '0')}:00`, total: parseFloat(total.toFixed(2)) }))
}

export function buildZReportData(sales: SaleRow[], locationName: string, date: string, cashierName: string) {
  const completed = sales.filter(s => s.status === 'completed')
  return {
    locationName,
    date,
    cashierName,
    totalSales:        parseFloat(completed.reduce((s, r) => s + r.total, 0).toFixed(2)),
    totalTransactions: completed.length,
    totalDiscount:     parseFloat(completed.reduce((s, r) => s + r.discount_amount, 0).toFixed(2)),
    totalTax:          parseFloat(completed.reduce((s, r) => s + r.tax_amount, 0).toFixed(2)),
    cashSales:         parseFloat(completed.filter(r => r.payment_method === 'cash').reduce((s, r) => s + r.total, 0).toFixed(2)),
    cardSales:         parseFloat(completed.filter(r => r.payment_method === 'card').reduce((s, r) => s + r.total, 0).toFixed(2)),
    bankSales:         parseFloat(completed.filter(r => r.payment_method === 'bank_transfer').reduce((s, r) => s + r.total, 0).toFixed(2)),
    loyaltySales:      parseFloat(completed.filter(r => r.payment_method === 'loyalty_points').reduce((s, r) => s + r.total, 0).toFixed(2)),
    netSales:          parseFloat((completed.reduce((s, r) => s + r.total, 0) - completed.reduce((s, r) => s + r.discount_amount, 0)).toFixed(2)),
    topProducts:       aggregateByProduct(completed, 5),
  }
}

// ── Dashboard ────────────────────────────────────────────────

export async function getDashboardStats(locationId: string, dateFrom: string, dateTo: string) {
  const supabase = createClient()
  let salesQuery = supabase
    .from('sales')
    .select('total, tax_amount, discount_amount, items:sale_items(quantity, product:products(cost))')
    .eq('status', 'completed')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
  if (locationId) salesQuery = salesQuery.eq('location_id', locationId)

  const [salesRes, customersRes] = await Promise.all([
    salesQuery,
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`),
  ])

  type SaleStat = {
    total: number
    tax_amount: number
    discount_amount: number
    items: { quantity: number; product: { cost: number | null } | null }[]
  }
  const sales = (salesRes.data ?? []) as unknown as SaleStat[]

  const totalRevenue     = sales.reduce((s, r) => s + r.total, 0)
  const totalExTax       = sales.reduce((s, r) => s + (r.total - r.tax_amount), 0)
  const totalTransactions = sales.length
  const avgSaleValue     = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  let totalCost = 0
  for (const s of sales) {
    for (const item of s.items) {
      totalCost += (item.product?.cost ?? 0) * item.quantity
    }
  }
  const grossProfit = totalExTax > 0 ? ((totalExTax - totalCost) / totalExTax) * 100 : 0

  return {
    totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
    totalExTax:       parseFloat(totalExTax.toFixed(2)),
    totalTransactions,
    avgSaleValue:     parseFloat(avgSaleValue.toFixed(2)),
    grossProfit:      parseFloat(grossProfit.toFixed(1)),
    newCustomers:     customersRes.count ?? 0,
  }
}

export async function getRefundsTotal(locationId: string, dateFrom: string, dateTo: string): Promise<number> {
  const supabase = createClient()
  // Get sale IDs for this location and date range that have refunds
  let salesQuery = supabase
    .from('sales')
    .select('id')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
    .in('status', ['refunded', 'partial_refund'])
  if (locationId) salesQuery = salesQuery.eq('location_id', locationId)
  const { data: sales } = await salesQuery
  if (!sales || sales.length === 0) return 0
  const saleIds = (sales as { id: string }[]).map(s => s.id)
  const { data: refunds } = await supabase
    .from('refunds')
    .select('amount')
    .in('sale_id', saleIds)
  return parseFloat(((refunds ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0).toFixed(2))
}

export function aggregateByDayOfWeek(sales: SaleRow[]) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const map = new Map<number, number>()
  for (let d = 0; d < 7; d++) map.set(d, 0)
  for (const s of sales) {
    const day = new Date(s.created_at).getDay()
    map.set(day, (map.get(day) ?? 0) + s.total)
  }
  return days.map((label, i) => ({ label, total: parseFloat((map.get(i) ?? 0).toFixed(2)) }))
}
