import { createClient } from '@/lib/supabase/client'

export interface CustomerAccount {
  id: string
  customer_id: string
  balance: number
  credit_limit: number
  updated_at: string
}

export interface AccountTransaction {
  id: string
  customer_id: string
  sale_id: string | null
  amount: number
  type: 'charge' | 'payment'
  note: string | null
  created_at: string
}

export async function getOrCreateAccount(customerId: string): Promise<CustomerAccount> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (existing) return existing as CustomerAccount

  const { data: created, error } = await supabase
    .from('customer_accounts')
    .insert({ customer_id: customerId, balance: 0, credit_limit: 500 })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return created as CustomerAccount
}

export async function chargeToAccount(
  customerId: string,
  saleId: string,
  amount: number
): Promise<void> {
  const supabase = createClient()
  const account = await getOrCreateAccount(customerId)

  await supabase
    .from('customer_accounts')
    .update({ balance: account.balance + amount, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)

  await supabase.from('account_transactions').insert({
    customer_id: customerId,
    sale_id: saleId,
    amount,
    type: 'charge',
    note: `Sale charge`,
  })
}

export async function recordAccountPayment(
  customerId: string,
  amount: number,
  note = 'Payment received'
): Promise<void> {
  const supabase = createClient()
  const account = await getOrCreateAccount(customerId)
  const newBalance = Math.max(0, account.balance - amount)

  await supabase
    .from('customer_accounts')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)

  await supabase.from('account_transactions').insert({
    customer_id: customerId,
    sale_id: null,
    amount,
    type: 'payment',
    note,
  })
}

export async function getAccountTransactions(customerId: string): Promise<AccountTransaction[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('account_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as AccountTransaction[]
}

export async function getAllAccountBalances(): Promise<
  { customer_id: string; customer_name: string; balance: number; credit_limit: number }[]
> {
  const supabase = createClient()
  const { data } = await supabase
    .from('customer_accounts')
    .select('*, customer:customers(full_name)')
    .gt('balance', 0)
    .order('balance', { ascending: false })
  return (data ?? []).map((r: any) => ({
    customer_id: r.customer_id,
    customer_name: r.customer?.full_name ?? 'Unknown',
    balance: r.balance,
    credit_limit: r.credit_limit,
  }))
}
