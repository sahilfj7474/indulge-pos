import { createClient } from '@/lib/supabase/client'
import { Sale } from '@/types'

export interface SaleFilters {
  locationId?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  paymentMethod?: string
  userId?: string
}

export async function getSales(filters: SaleFilters = {}): Promise<Sale[]> {
  const supabase = createClient()
  let query = supabase
    .from('sales')
    .select('*, user:users(full_name), customer:customers(full_name), location:locations(name), items:sale_items(*, product:products(name))')
    .order('created_at', { ascending: false })

  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.dateFrom)   query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo)     query = query.lte('created_at', filters.dateTo)
  if (filters.status)     query = query.eq('status', filters.status)
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters.userId)     query = query.eq('user_id', filters.userId)

  const { data } = await query.limit(500)
  return (data ?? []) as unknown as Sale[]
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('sales')
    .select('*, user:users(full_name), customer:customers(full_name, loyalty_points), location:locations(*), items:sale_items(*, product:products(name, price))')
    .eq('id', id)
    .single()
  return data as unknown as Sale | null
}

export async function voidSale(saleId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sales')
    .update({ status: 'voided' })
    .eq('id', saleId)
  if (error) throw new Error(error.message)
}

export async function getDailySummary(locationId: string, date: string) {
  const supabase = createClient()
  const start = `${date}T00:00:00`
  const end   = `${date}T23:59:59`

  const { data } = await supabase
    .from('sales')
    .select('total, discount_amount, tax_amount, payment_method, status')
    .eq('location_id', locationId)
    .gte('created_at', start)
    .lte('created_at', end)

  const sales = (data ?? []) as { total: number; discount_amount: number; tax_amount: number; payment_method: string; status: string }[]
  const completed = sales.filter(s => s.status === 'completed')

  return {
    totalSales:       completed.reduce((s, r) => s + r.total, 0),
    totalTransactions: completed.length,
    totalDiscount:    completed.reduce((s, r) => s + r.discount_amount, 0),
    totalTax:         completed.reduce((s, r) => s + r.tax_amount, 0),
    cashSales:        completed.filter(r => r.payment_method === 'cash').reduce((s, r) => s + r.total, 0),
    cardSales:        completed.filter(r => r.payment_method === 'card').reduce((s, r) => s + r.total, 0),
    bankSales:        completed.filter(r => r.payment_method === 'bank_transfer').reduce((s, r) => s + r.total, 0),
    loyaltySales:     completed.filter(r => r.payment_method === 'loyalty_points').reduce((s, r) => s + r.total, 0),
  }
}
