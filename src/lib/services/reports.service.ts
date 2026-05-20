import { createClient } from '@/lib/supabase/client'
import { localDayStart, localDayEnd } from '@/lib/utils'

// ── Core data types ───────────────────────────────────────────────────────────

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
  items: {
    product_id: string
    quantity: number
    total: number
    product: {
      name: string
      category_id: string | null
      cost: number | null
      category: { name: string } | null
    }
  }[]
  user: { full_name: string }
}

export interface CustomerRow {
  full_name:      string
  email:          string | null
  tx_count:       number
  total_spent:    number
  avg_spend:      number
  loyalty_points: number
}

export interface RefundRow {
  id:          string
  sale_id:     string   // already sliced to 8-char display
  user_name:   string
  amount:      number
  reason:      string
  created_at:  string
}

// ── Main sales fetch ──────────────────────────────────────────────────────────

export async function fetchSalesForReport(
  locationIds: string | string[],
  dateFrom: string,
  dateTo: string
): Promise<SaleRow[]> {
  const supabase = createClient()
  const ids = Array.isArray(locationIds) ? locationIds : (locationIds ? [locationIds] : [])

  let query = supabase
    .from('sales')
    .select(`
      id, created_at, total, subtotal, discount_amount, tax_amount,
      payment_method, status, user_id, customer_id,
      user:users(full_name),
      items:sale_items(product_id, quantity, total,
        product:products(name, category_id, cost, category:categories(name)))
    `)
    .eq('status', 'completed')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
    .order('created_at')
    .limit(2000)

  if (ids.length === 1) query = query.eq('location_id', ids[0])
  else if (ids.length > 1) query = query.in('location_id', ids)

  const { data } = await query
  return (data ?? []) as unknown as SaleRow[]
}

// ── Async supplementary queries ───────────────────────────────────────────────

export async function getRefundsTotal(
  locationIds: string | string[],
  dateFrom: string,
  dateTo: string
): Promise<number> {
  const supabase = createClient()
  const ids = Array.isArray(locationIds) ? locationIds : (locationIds ? [locationIds] : [])

  let salesQuery = supabase
    .from('sales')
    .select('id')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
    .in('status', ['refunded', 'partial_refund'])

  if (ids.length === 1) salesQuery = salesQuery.eq('location_id', ids[0])
  else if (ids.length > 1) salesQuery = salesQuery.in('location_id', ids)

  const { data: sales } = await salesQuery
  if (!sales || sales.length === 0) return 0

  const saleIds = (sales as { id: string }[]).map(s => s.id)
  const { data: refunds } = await supabase.from('refunds').select('amount').in('sale_id', saleIds)
  return parseFloat(((refunds ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0).toFixed(2))
}

export async function getRefundDetails(
  locationIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<RefundRow[]> {
  const supabase = createClient()

  let salesQuery = supabase
    .from('sales')
    .select('id')
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))

  if (locationIds.length === 1) salesQuery = salesQuery.eq('location_id', locationIds[0])
  else if (locationIds.length > 1) salesQuery = salesQuery.in('location_id', locationIds)

  const { data: salesData } = await salesQuery
  if (!salesData?.length) return []

  const saleIds = (salesData as { id: string }[]).map(s => s.id)
  const { data } = await supabase
    .from('refunds')
    .select('id, sale_id, amount, reason, created_at, user:users(full_name)')
    .in('sale_id', saleIds)
    .order('created_at', { ascending: false })
    .limit(500)

  return ((data ?? []) as unknown as {
    id: string; sale_id: string; amount: number; reason: string | null;
    created_at: string; user: { full_name: string } | null
  }[]).map(r => ({
    id:         r.id,
    sale_id:    r.sale_id.slice(0, 8).toUpperCase(),
    user_name:  r.user?.full_name ?? 'Unknown',
    amount:     r.amount,
    reason:     r.reason ?? 'No reason provided',
    created_at: r.created_at,
  }))
}

export async function getTopCustomers(
  locationIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<CustomerRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('sales')
    .select('total, customer_id, customer:customers(id, full_name, email, loyalty_points)')
    .eq('status', 'completed')
    .not('customer_id', 'is', null)
    .gte('created_at', localDayStart(dateFrom))
    .lte('created_at', localDayEnd(dateTo))
    .limit(2000)

  if (locationIds.length === 1) query = query.eq('location_id', locationIds[0])
  else if (locationIds.length > 1) query = query.in('location_id', locationIds)

  const { data } = await query

  type Row = { total: number; customer: { id: string; full_name: string; email: string | null; loyalty_points: number } | null }
  const map = new Map<string, { full_name: string; email: string | null; count: number; total: number; loyalty_points: number }>()

  for (const row of ((data ?? []) as unknown as Row[])) {
    const c = row.customer
    if (!c?.id) continue
    const ex = map.get(c.id) ?? { full_name: c.full_name, email: c.email, count: 0, total: 0, loyalty_points: c.loyalty_points ?? 0 }
    map.set(c.id, { ...ex, count: ex.count + 1, total: ex.total + row.total })
  }

  return Array.from(map.values())
    .map(v => ({
      full_name:      v.full_name,
      email:          v.email,
      tx_count:       v.count,
      total_spent:    parseFloat(v.total.toFixed(2)),
      avg_spend:      parseFloat((v.total / v.count).toFixed(2)),
      loyalty_points: v.loyalty_points,
    }))
    .sort((a, b) => b.total_spent - a.total_spent)
    .slice(0, 25)
}

// ── Client-side aggregations ──────────────────────────────────────────────────

/** Day-by-day breakdown of sales activity */
export function aggregateDailySummary(sales: SaleRow[]) {
  const map = new Map<string, { count: number; subtotal: number; discount: number; tax: number; total: number; items: number }>()
  for (const s of sales) {
    const day = s.created_at.slice(0, 10)
    const ex  = map.get(day) ?? { count: 0, subtotal: 0, discount: 0, tax: 0, total: 0, items: 0 }
    map.set(day, {
      count:    ex.count + 1,
      subtotal: ex.subtotal + s.subtotal,
      discount: ex.discount + s.discount_amount,
      tax:      ex.tax + s.tax_amount,
      total:    ex.total + s.total,
      items:    ex.items + s.items.reduce((sum, i) => sum + i.quantity, 0),
    })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      count:    v.count,
      items:    v.items,
      subtotal: parseFloat(v.subtotal.toFixed(2)),
      discount: parseFloat(v.discount.toFixed(2)),
      tax:      parseFloat(v.tax.toFixed(2)),
      total:    parseFloat(v.total.toFixed(2)),
      avg:      parseFloat((v.total / v.count).toFixed(2)),
    }))
}

/** Sales trend (date → total), used for the line chart */
export function aggregateSalesTrend(sales: SaleRow[]) {
  const map = new Map<string, number>()
  for (const s of sales) {
    const day = s.created_at.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + s.total)
  }
  const labels = Array.from(map.keys()).sort()
  return { labels, data: labels.map(l => parseFloat(map.get(l)!.toFixed(2))) }
}

/** Revenue + transaction count per day of week (0 = Sun … 6 = Sat) */
export function aggregateByDayOfWeek(sales: SaleRow[]) {
  const DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const map = new Map<number, { total: number; count: number }>()
  for (let d = 0; d < 7; d++) map.set(d, { total: 0, count: 0 })
  for (const s of sales) {
    const day = new Date(s.created_at).getDay()
    const ex  = map.get(day)!
    map.set(day, { total: ex.total + s.total, count: ex.count + 1 })
  }
  return DAYS.map((label, i) => {
    const v = map.get(i)!
    return {
      label,
      short: SHORT[i],
      total: parseFloat(v.total.toFixed(2)),
      count: v.count,
      avg:   v.count > 0 ? parseFloat((v.total / v.count).toFixed(2)) : 0,
    }
  })
}

/** Revenue + transaction count per hour (0–23) */
export function aggregateHourly(sales: SaleRow[]) {
  const map = new Map<number, { total: number; count: number }>()
  for (let h = 0; h < 24; h++) map.set(h, { total: 0, count: 0 })
  for (const s of sales) {
    const hour = new Date(s.created_at).getHours()
    const ex   = map.get(hour)!
    map.set(hour, { total: ex.total + s.total, count: ex.count + 1 })
  }
  return Array.from(map.entries()).map(([hour, v]) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    total: parseFloat(v.total.toFixed(2)),
    count: v.count,
    avg:   v.count > 0 ? parseFloat((v.total / v.count).toFixed(2)) : 0,
  }))
}

/** Top N products by revenue */
export function aggregateByProduct(sales: SaleRow[], limit = 15) {
  const map = new Map<string, { qty: number; total: number }>()
  for (const s of sales) {
    for (const item of s.items) {
      const name = item.product?.name ?? 'Unknown'
      const ex   = map.get(name) ?? { qty: 0, total: 0 }
      map.set(name, { qty: ex.qty + item.quantity, total: ex.total + item.total })
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, qty: v.qty, total: parseFloat(v.total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/** Per-product cost / margin analysis — requires cost data in items */
export function aggregateProductMargin(sales: SaleRow[]) {
  const map = new Map<string, { qty: number; revenue: number; cost: number }>()
  for (const s of sales) {
    for (const item of s.items) {
      const name = item.product?.name ?? 'Unknown'
      const ex   = map.get(name) ?? { qty: 0, revenue: 0, cost: 0 }
      map.set(name, {
        qty:     ex.qty + item.quantity,
        revenue: ex.revenue + item.total,
        cost:    ex.cost + (item.product?.cost ?? 0) * item.quantity,
      })
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => {
      const profit = v.revenue - v.cost
      const margin = v.revenue > 0 ? (profit / v.revenue) * 100 : 0
      return {
        name,
        qty:     v.qty,
        revenue: parseFloat(v.revenue.toFixed(2)),
        cost:    parseFloat(v.cost.toFixed(2)),
        profit:  parseFloat(profit.toFixed(2)),
        margin:  parseFloat(margin.toFixed(1)),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/** Revenue by category */
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

/** Revenue per payment method */
export function aggregateByPayment(sales: SaleRow[]) {
  const map = new Map<string, { total: number; count: number }>()
  for (const s of sales) {
    const ex = map.get(s.payment_method) ?? { total: 0, count: 0 }
    map.set(s.payment_method, { total: ex.total + s.total, count: ex.count + 1 })
  }
  return Array.from(map.entries())
    .map(([method, v]) => ({
      method,
      total: parseFloat(v.total.toFixed(2)),
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)
}

/** Revenue by staff member */
export function aggregateByStaff(sales: SaleRow[]) {
  const map = new Map<string, { count: number; total: number; discount: number }>()
  for (const s of sales) {
    const name = (s.user as unknown as { full_name: string })?.full_name ?? 'Unknown'
    const ex   = map.get(name) ?? { count: 0, total: 0, discount: 0 }
    map.set(name, { count: ex.count + 1, total: ex.total + s.total, discount: ex.discount + s.discount_amount })
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      count:    v.count,
      total:    parseFloat(v.total.toFixed(2)),
      discount: parseFloat(v.discount.toFixed(2)),
      avg:      parseFloat((v.total / v.count).toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
}

/** Discount behaviour per staff member */
export function aggregateDiscountByStaff(sales: SaleRow[]) {
  const map = new Map<string, { total_sales: number; discount_total: number; with_discount: number; count: number }>()
  for (const s of sales) {
    const name = (s.user as unknown as { full_name: string })?.full_name ?? 'Unknown'
    const ex   = map.get(name) ?? { total_sales: 0, discount_total: 0, with_discount: 0, count: 0 }
    map.set(name, {
      total_sales:    ex.total_sales + s.total,
      discount_total: ex.discount_total + s.discount_amount,
      with_discount:  ex.with_discount + (s.discount_amount > 0 ? 1 : 0),
      count:          ex.count + 1,
    })
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      count:          v.count,
      with_discount:  v.with_discount,
      discount_total: parseFloat(v.discount_total.toFixed(2)),
      discount_rate:  v.count > 0 ? parseFloat(((v.with_discount / v.count) * 100).toFixed(1)) : 0,
      avg_discount:   v.with_discount > 0 ? parseFloat((v.discount_total / v.with_discount).toFixed(2)) : 0,
      total_sales:    parseFloat(v.total_sales.toFixed(2)),
    }))
    .sort((a, b) => b.discount_total - a.discount_total)
}

// ── Z / X Report ──────────────────────────────────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
    total: number; tax_amount: number; discount_amount: number
    items: { quantity: number; product: { cost: number | null } | null }[]
  }
  const sales = (salesRes.data ?? []) as unknown as SaleStat[]

  const totalRevenue      = sales.reduce((s, r) => s + r.total, 0)
  const totalExTax        = sales.reduce((s, r) => s + (r.total - r.tax_amount), 0)
  const totalTransactions = sales.length
  const avgSaleValue      = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  let totalCost = 0
  for (const s of sales)
    for (const item of s.items)
      totalCost += (item.product?.cost ?? 0) * item.quantity

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
