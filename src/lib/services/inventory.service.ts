import { createClient } from '@/lib/supabase/client'
import { InventoryItem, InventoryAdjustment } from '@/types'

export async function getInventory(locationId: string): Promise<InventoryItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('inventory')
    .select('*, product:products(*, category:categories(*))')
    .eq('location_id', locationId)
    .order('quantity', { ascending: true })
  return (data ?? []) as unknown as InventoryItem[]
}

export async function getAllInventory(): Promise<InventoryItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('inventory')
    .select('*, product:products(*, category:categories(*)), location:locations(*)')
    .order('quantity', { ascending: true })
  return (data ?? []) as unknown as InventoryItem[]
}

export async function adjustInventory(params: {
  productId: string
  locationId: string
  userId: string
  quantityChange: number
  reason: string
}): Promise<void> {
  const supabase = createClient()

  // Get current quantity
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', params.productId)
    .eq('location_id', params.locationId)
    .single()

  const current = inv?.quantity ?? 0
  const newQty = Math.max(0, current + params.quantityChange)

  // Upsert inventory record
  await supabase.from('inventory').upsert({
    product_id: params.productId,
    location_id: params.locationId,
    quantity: newQty,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id,location_id' })

  // Record adjustment
  await supabase.from('inventory_adjustments').insert({
    product_id: params.productId,
    location_id: params.locationId,
    user_id: params.userId,
    quantity_change: params.quantityChange,
    reason: params.reason || null,
  })
}

export async function updateLowStockThreshold(
  productId: string,
  locationId: string,
  threshold: number
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('inventory')
    .update({ low_stock_threshold: threshold })
    .eq('product_id', productId)
    .eq('location_id', locationId)
}

export async function getAdjustmentHistory(
  locationId: string,
  limit = 50
): Promise<InventoryAdjustment[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('inventory_adjustments')
    .select('*, product:products(name), user:users(full_name)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as InventoryAdjustment[]
}
