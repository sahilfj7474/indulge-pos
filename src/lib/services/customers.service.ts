import { createClient } from '@/lib/supabase/client'
import { Customer, CustomerGroup } from '@/types'

// ─── Customer Groups ──────────────────────────────────────────────────────────

export async function getCustomerGroups(): Promise<CustomerGroup[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('customer_groups')
    .select('*')
    .order('name')
  return (data ?? []) as CustomerGroup[]
}

export async function saveCustomerGroup(group: Partial<CustomerGroup> & { name: string }): Promise<void> {
  const supabase = createClient()
  if (group.id) {
    const { error } = await supabase
      .from('customer_groups')
      .update({ name: group.name, discount_type: group.discount_type, discount_value: group.discount_value })
      .eq('id', group.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('customer_groups')
      .insert({ name: group.name, discount_type: group.discount_type ?? 'none', discount_value: group.discount_value ?? 0 })
    if (error) throw new Error(error.message)
  }
}

export async function deleteCustomerGroup(id: string): Promise<void> {
  const supabase = createClient()
  // Remove group reference from customers first
  await supabase.from('customers').update({ customer_group_id: null }).eq('customer_group_id', id)
  const { error } = await supabase.from('customer_groups').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('customer_group_id', groupId)
  return count ?? 0
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function searchCustomers(query: string): Promise<Customer[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('customers')
    .select('*, customer_group:customer_groups(id,name,discount_type,discount_value,is_default,created_at)')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('full_name')
    .limit(10)
  return (data ?? []) as Customer[]
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('customers')
    .select('*, customer_group:customer_groups(*)')
    .eq('id', id)
    .single()
  return data as Customer | null
}

export async function createCustomer(payload: Partial<Customer> & { full_name: string }): Promise<Customer | null> {
  const supabase = createClient()
  const { data: created } = await supabase.from('customers').insert(payload).select().single()
  return created as Customer | null
}

export async function updateCustomer(id: string, payload: Partial<Customer>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('customers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getCustomerSales(customerId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('sales')
    .select('*, location:locations(name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as any[]
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
