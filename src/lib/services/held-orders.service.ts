import { createClient } from '@/lib/supabase/client'
import { CartItem, Customer } from '@/types'

export interface HeldOrderData {
  items: CartItem[]
  customer: Customer | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  loyaltyPointsToRedeem: number
  surchargeAmount: number
}

export interface HeldOrderRecord {
  id: string
  label: string
  data: HeldOrderData
  created_at: string
}

export async function getHeldOrders(locationId: string): Promise<HeldOrderRecord[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('held_orders')
    .select('id, label, data, created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
  return (data ?? []) as HeldOrderRecord[]
}

export async function saveHeldOrder(
  locationId: string,
  userId: string,
  label: string,
  orderData: HeldOrderData
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('held_orders').insert({
    location_id: locationId,
    user_id: userId,
    label,
    data: orderData,
  })
  if (error) throw new Error(error.message)
}

export async function deleteHeldOrder(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('held_orders').delete().eq('id', id)
}
