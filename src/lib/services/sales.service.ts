import { createClient } from '@/lib/supabase/client'
import { Sale } from '@/types'
import { localDayStart, localDayEnd } from '@/lib/utils'

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
    .select('*, user:users(full_name), customer:customers(full_name, loyalty_points), location:locations(*), items:sale_items(*, product:products(name, price, sku, image_url))')
    .eq('id', id)
    .single()
  return data as unknown as Sale | null
}

export async function updateSaleNotes(saleId: string, notes: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('sales').update({ notes }).eq('id', saleId)
  if (error) throw new Error(error.message)
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
  const start = localDayStart(date)
  const end   = localDayEnd(date)

  const { data } = await supabase
    .from('sales')
    .select('total, discount_amount, tax_amount, payment_method, payment_details, status')
    .eq('location_id', locationId)
    .gte('created_at', start)
    .lte('created_at', end)

  type SaleSum = {
    total: number; discount_amount: number; tax_amount: number
    payment_method: string; status: string
    payment_details: { splits: { method: string; amount: number }[] } | null
  }
  const sales = (data ?? []) as SaleSum[]
  const completed = sales.filter(s => s.status === 'completed')

  /** Sum a single payment method, expanding split transactions */
  function sumMethod(method: string): number {
    return completed.reduce((acc, r) => {
      if (r.payment_method === method) return acc + r.total
      if (r.payment_method === 'split') {
        const sp = r.payment_details?.splits?.find(x => x.method === method)
        if (sp) return acc + sp.amount
      }
      return acc
    }, 0)
  }

  return {
    totalSales:        completed.reduce((s, r) => s + r.total, 0),
    totalTransactions: completed.length,
    totalDiscount:     completed.reduce((s, r) => s + r.discount_amount, 0),
    totalTax:          completed.reduce((s, r) => s + r.tax_amount, 0),
    cashSales:         sumMethod('cash'),
    cardSales:         sumMethod('card'),
    bankSales:         sumMethod('bank_transfer'),
    loyaltySales:      sumMethod('loyalty_points'),
  }
}
