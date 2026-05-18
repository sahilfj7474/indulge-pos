import { createClient } from '@/lib/supabase/client'
import { PurchaseOrder } from '@/types'

export async function getPurchaseOrders(locationId?: string): Promise<PurchaseOrder[]> {
  const supabase = createClient()
  let q = supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(name), location:locations(name), user:users(full_name)')
    .order('created_at', { ascending: false })
  if (locationId) q = q.eq('location_id', locationId)
  const { data } = await q
  return (data ?? []) as unknown as PurchaseOrder[]
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(*), location:locations(name), user:users(full_name), items:purchase_order_items(*, product:products(name,sku))')
    .eq('id', id)
    .single()
  return data as unknown as PurchaseOrder | null
}

export async function createPurchaseOrder(
  supplierId: string,
  locationId: string,
  userId: string,
  notes: string,
  items: { product_id: string; quantity_ordered: number; unit_cost: number }[]
): Promise<PurchaseOrder> {
  const supabase = createClient()
  const total = items.reduce((sum, i) => sum + i.quantity_ordered * i.unit_cost, 0)
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({ supplier_id: supplierId, location_id: locationId, user_id: userId, notes: notes || null, total })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create PO')
  if (items.length > 0) {
    await supabase.from('purchase_order_items').insert(
      items.map(i => ({
        purchase_order_id: data.id,
        product_id: i.product_id,
        quantity_ordered: i.quantity_ordered,
        unit_cost: i.unit_cost,
        total: i.quantity_ordered * i.unit_cost,
      }))
    )
  }
  return data as PurchaseOrder
}

export async function updatePOStatus(
  id: string,
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
): Promise<void> {
  const supabase = createClient()
  await supabase.from('purchase_orders').update({ status }).eq('id', id)
}

export async function receivePurchaseOrder(
  poId: string,
  locationId: string,
  userId: string,
  items: { id: string; product_id: string; quantity_received: number }[]
): Promise<void> {
  const supabase = createClient()
  for (const item of items) {
    if (item.quantity_received <= 0) continue
    await supabase.from('purchase_order_items').update({ quantity_received: item.quantity_received }).eq('id', item.id)
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', item.product_id)
      .eq('location_id', locationId)
      .maybeSingle()
    if (inv) {
      await supabase.from('inventory').update({ quantity: inv.quantity + item.quantity_received }).eq('id', inv.id)
    } else {
      await supabase.from('inventory').insert({ product_id: item.product_id, location_id: locationId, quantity: item.quantity_received })
    }
    await supabase.from('inventory_adjustments').insert({
      product_id: item.product_id,
      location_id: locationId,
      user_id: userId,
      quantity_change: item.quantity_received,
      reason: `Purchase order received`,
    })
  }
  await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', poId)
}
