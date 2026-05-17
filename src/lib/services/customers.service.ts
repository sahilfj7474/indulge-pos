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
