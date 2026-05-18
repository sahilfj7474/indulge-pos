import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'

export async function searchCustomers(query: string): Promise<Customer[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('full_name')
    .limit(10)
  return (data ?? []) as Customer[]
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = createClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).single()
  return data as Customer | null
}

export async function createCustomer(data: {
  full_name: string
  email?: string
  phone?: string
}): Promise<Customer | null> {
  const supabase = createClient()
  const { data: created } = await supabase.from('customers').insert(data).select().single()
  return created as Customer | null
}

export async function getCustomerSales(customerId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(name)), location:locations(name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as any[]
}

export async function updateCustomer(id: string, payload: Partial<Customer>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('customers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function adjustLoyaltyPoints(customerId: string, points: number, note: string): Promise<void> {
  const supabase = createClient()
  const { data: customer } = await supabase.from('customers').select('loyalty_points').eq('id', customerId).single()
  if (!customer) return
  const newBalance = Math.max(0, (customer as any).loyalty_points + points)
  await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customerId)
  await supabase.from('loyalty_transactions').insert({
    customer_id: customerId,
    points,
    type: 'adjustment',
    note,
  })
}
