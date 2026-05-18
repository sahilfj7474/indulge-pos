import { createClient } from '@/lib/supabase/client'
import { CartItem, Layby, PaymentMethod } from '@/types'

export async function getLaybys(locationId: string): Promise<Layby[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('laybys')
    .select('*, customer:customers(full_name, phone), items:layby_items(*, product:products(name)), payments:layby_payments(*)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Layby[]
}

export async function createLayby(
  locationId: string,
  userId: string,
  customerId: string,
  items: CartItem[],
  depositAmount: number,
  paymentMethod: PaymentMethod,
  notes: string
): Promise<Layby> {
  const supabase = createClient()
  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount_amount, 0)
  const { data, error } = await supabase
    .from('laybys')
    .insert({
      location_id: locationId,
      user_id: userId,
      customer_id: customerId,
      total,
      deposit_paid: depositAmount,
      notes: notes || null,
    })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create layby')

  await supabase.from('layby_items').insert(
    items.map(i => ({
      layby_id: data.id,
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.unit_price * i.quantity - i.discount_amount,
    }))
  )

  if (depositAmount > 0) {
    await supabase.from('layby_payments').insert({
      layby_id: data.id,
      amount: depositAmount,
      payment_method: paymentMethod,
    })
  }
  return data as Layby
}

export async function makeLaybyPayment(
  laybyId: string,
  amount: number,
  paymentMethod: PaymentMethod
): Promise<void> {
  const supabase = createClient()
  const { data: layby } = await supabase.from('laybys').select('deposit_paid, total').eq('id', laybyId).single()
  if (!layby) throw new Error('Layby not found')
  const newDeposit = (layby as any).deposit_paid + amount
  const isComplete = newDeposit >= (layby as any).total
  await supabase.from('layby_payments').insert({ layby_id: laybyId, amount, payment_method: paymentMethod })
  await supabase.from('laybys').update({
    deposit_paid: newDeposit,
    status: isComplete ? 'completed' : 'active',
  }).eq('id', laybyId)
}

export async function cancelLayby(laybyId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('laybys').update({ status: 'cancelled' }).eq('id', laybyId)
}
