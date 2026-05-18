import { createClient } from '@/lib/supabase/client'

export interface RefundItemInput {
  sale_item_id: string
  product_id: string
  quantity: number
  unit_price: number
}

export async function createRefund(
  saleId: string,
  userId: string,
  items: RefundItemInput[],
  reason: string
): Promise<void> {
  const supabase = createClient()
  const amount = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const { data: refund, error } = await supabase
    .from('refunds')
    .insert({ sale_id: saleId, user_id: userId, amount, reason: reason || null })
    .select()
    .single()
  if (error || !refund) throw new Error(error?.message ?? 'Failed to create refund')

  await supabase.from('refund_items').insert(
    items.map(i => ({
      refund_id: refund.id,
      sale_item_id: i.sale_item_id,
      product_id: i.product_id,
      quantity: i.quantity,
      amount: i.unit_price * i.quantity,
    }))
  )

  // Determine full vs partial refund
  const { data: sale } = await supabase
    .from('sales')
    .select('items:sale_items(id, quantity)')
    .eq('id', saleId)
    .single()

  if (sale) {
    const saleItems = (sale as any).items as { id: string; quantity: number }[]
    const refundedItemIds = new Set(items.map(i => i.sale_item_id))
    const allRefunded = saleItems.every(si => {
      if (!refundedItemIds.has(si.id)) return false
      const ri = items.find(i => i.sale_item_id === si.id)
      return ri && ri.quantity >= si.quantity
    })
    await supabase.from('sales').update({ status: allRefunded ? 'refunded' : 'partial_refund' }).eq('id', saleId)
  }
}
