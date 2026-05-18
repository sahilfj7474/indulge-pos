import { createClient } from '@/lib/supabase/client'
import { StockTransfer } from '@/types'

export async function getStockTransfers(locationId: string): Promise<StockTransfer[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('stock_transfers')
    .select(`
      *,
      from_location:locations!stock_transfers_from_location_id_fkey(name),
      to_location:locations!stock_transfers_to_location_id_fkey(name),
      user:users(full_name)
    `)
    .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as StockTransfer[]
}

export async function createStockTransfer(
  fromLocationId: string,
  toLocationId: string,
  userId: string,
  notes: string,
  items: { product_id: string; quantity: number }[]
): Promise<StockTransfer> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stock_transfers')
    .insert({ from_location_id: fromLocationId, to_location_id: toLocationId, user_id: userId, notes: notes || null })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create transfer')
  if (items.length > 0) {
    await supabase.from('stock_transfer_items').insert(
      items.map(i => ({ stock_transfer_id: data.id, product_id: i.product_id, quantity: i.quantity }))
    )
  }
  return data as StockTransfer
}

export async function completeStockTransfer(transferId: string, userId: string): Promise<void> {
  const supabase = createClient()
  const { data: transfer } = await supabase
    .from('stock_transfers')
    .select('*, items:stock_transfer_items(*)')
    .eq('id', transferId)
    .single()
  if (!transfer) throw new Error('Transfer not found')

  for (const item of (transfer as any).items) {
    // Deduct from source
    const { data: fromInv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', item.product_id)
      .eq('location_id', transfer.from_location_id)
      .maybeSingle()
    if (fromInv) {
      await supabase.from('inventory').update({ quantity: Math.max(0, fromInv.quantity - item.quantity) }).eq('id', fromInv.id)
      await supabase.from('inventory_adjustments').insert({
        product_id: item.product_id,
        location_id: transfer.from_location_id,
        user_id: userId,
        quantity_change: -item.quantity,
        reason: 'Stock transfer out',
      })
    }
    // Add to destination
    const { data: toInv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', item.product_id)
      .eq('location_id', transfer.to_location_id)
      .maybeSingle()
    if (toInv) {
      await supabase.from('inventory').update({ quantity: toInv.quantity + item.quantity }).eq('id', toInv.id)
    } else {
      await supabase.from('inventory').insert({ product_id: item.product_id, location_id: transfer.to_location_id, quantity: item.quantity })
    }
    await supabase.from('inventory_adjustments').insert({
      product_id: item.product_id,
      location_id: transfer.to_location_id,
      user_id: userId,
      quantity_change: item.quantity,
      reason: 'Stock transfer in',
    })
  }
  await supabase.from('stock_transfers').update({ status: 'completed' }).eq('id', transferId)
}

export async function cancelStockTransfer(transferId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('stock_transfers').update({ status: 'cancelled' }).eq('id', transferId)
}
