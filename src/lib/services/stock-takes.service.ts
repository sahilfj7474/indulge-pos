import { createClient } from '@/lib/supabase/client'
import { StockTake } from '@/types'

export interface StockTakeItemRow {
  id: string
  product_id: string
  expected_qty: number
  counted_qty: number
  variance: number
  product: { name: string; sku: string | null; barcode: string | null }
}

export async function getStockTakes(locationId: string): Promise<StockTake[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('stock_takes')
    .select('*, user:users(full_name)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as StockTake[]
}

export async function createStockTake(locationId: string, userId: string, notes?: string): Promise<StockTake> {
  const supabase = createClient()
  const { data: inventory } = await supabase
    .from('inventory')
    .select('product_id, quantity')
    .eq('location_id', locationId)

  const { data, error } = await supabase
    .from('stock_takes')
    .insert({ location_id: locationId, user_id: userId, notes: notes || null })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create stock take')

  if (inventory && inventory.length > 0) {
    await supabase.from('stock_take_items').insert(
      (inventory as any[]).map(i => ({
        stock_take_id: data.id,
        product_id: i.product_id,
        expected_qty: i.quantity,
        counted_qty: i.quantity,
      }))
    )
  }
  return data as StockTake
}

export async function getStockTakeItems(stockTakeId: string): Promise<StockTakeItemRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('stock_take_items')
    .select('id, product_id, expected_qty, counted_qty, variance, product:products(name, sku, barcode)')
    .eq('stock_take_id', stockTakeId)
  return (data ?? []) as unknown as StockTakeItemRow[]
}

export async function updateStockTakeItem(id: string, countedQty: number): Promise<void> {
  const supabase = createClient()
  await supabase.from('stock_take_items').update({ counted_qty: countedQty }).eq('id', id)
}

export async function completeStockTake(stockTakeId: string, locationId: string, userId: string): Promise<void> {
  const supabase = createClient()
  const items = await getStockTakeItems(stockTakeId)
  for (const item of items) {
    if (item.counted_qty === item.expected_qty) continue
    const { data: inv } = await supabase
      .from('inventory')
      .select('id')
      .eq('product_id', item.product_id)
      .eq('location_id', locationId)
      .maybeSingle()
    if (inv) {
      await supabase.from('inventory').update({ quantity: item.counted_qty }).eq('id', inv.id)
      await supabase.from('inventory_adjustments').insert({
        product_id: item.product_id,
        location_id: locationId,
        user_id: userId,
        quantity_change: item.variance,
        reason: 'Stock take adjustment',
      })
    }
  }
  await supabase.from('stock_takes').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', stockTakeId)
}
