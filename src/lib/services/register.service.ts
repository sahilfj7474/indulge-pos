import { createClient } from '@/lib/supabase/client'
import { Register } from '@/types'

export async function getOpenRegister(locationId: string, userId: string): Promise<Register | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('registers')
    .select('*')
    .eq('location_id', locationId)
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as Register | null
}

export async function openRegister(locationId: string, userId: string, openingFloat: number): Promise<Register> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('registers')
    .insert({ location_id: locationId, user_id: userId, opening_float: openingFloat })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to open register')
  return data as Register
}

export async function closeRegister(registerId: string, closingFloat: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('registers')
    .update({ status: 'closed', closing_float: closingFloat, closed_at: new Date().toISOString() })
    .eq('id', registerId)
  if (error) throw new Error(error.message)
}

export async function addCashMovement(registerId: string, type: 'in' | 'out', amount: number): Promise<void> {
  const supabase = createClient()
  const field = type === 'in' ? 'cash_in' : 'cash_out'
  const { data: register } = await supabase.from('registers').select(field).eq('id', registerId).single()
  if (!register) return
  const current = (register as Record<string, number>)[field] ?? 0
  await supabase.from('registers').update({ [field]: current + amount }).eq('id', registerId)
}

export async function getRegisterHistory(locationId: string, limit = 20): Promise<Register[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('registers')
    .select('*, user:users(full_name)')
    .eq('location_id', locationId)
    .order('opened_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as Register[]
}

export async function getRegisterSalesSummary(locationId: string, openedAt: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('sales')
    .select('payment_method, total, discount_amount, tax_amount')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .gte('created_at', openedAt)

  const rows = (data ?? []) as {
    payment_method: string
    total: number
    discount_amount: number
    tax_amount: number
  }[]

  const tally: Record<string, number> = {}
  let totalSales = 0, totalDiscounts = 0, totalTax = 0

  for (const s of rows) {
    tally[s.payment_method] = (tally[s.payment_method] ?? 0) + s.total
    totalSales    += s.total
    totalDiscounts += s.discount_amount
    totalTax      += s.tax_amount
  }

  return {
    tally,
    totalSales:     parseFloat(totalSales.toFixed(2)),
    totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
    totalTax:       parseFloat(totalTax.toFixed(2)),
    transactionCount: rows.length,
  }
}
