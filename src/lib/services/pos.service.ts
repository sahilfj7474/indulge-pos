import { createClient } from '@/lib/supabase/client'
import { CartItem, PaymentMethod, Sale } from '@/types'
import { calculateLoyaltyPoints } from '@/lib/utils'

export interface SplitPayment {
  method: Exclude<PaymentMethod, 'split'>
  amount: number
}

export interface CompleteSaleParams {
  locationId: string
  userId: string
  customerId: string | null
  items: CartItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  surchargeAmount: number
  total: number
  paymentMethod: PaymentMethod
  splitPayments?: SplitPayment[]
  loyaltyPointsRedeemed: number
  notes: string
}

export async function completeSale(params: CompleteSaleParams): Promise<Sale> {
  const supabase = createClient()

  const paymentDetails = params.splitPayments && params.splitPayments.length > 0
    ? { splits: params.splitPayments }
    : null

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      location_id: params.locationId,
      user_id: params.userId,
      customer_id: params.customerId || null,
      subtotal: params.subtotal,
      discount_amount: params.discountAmount,
      tax_amount: params.taxAmount,
      surcharge_amount: params.surchargeAmount,
      total: params.total,
      payment_method: params.paymentMethod,
      payment_details: paymentDetails,
      notes: params.notes || null,
      status: 'completed',
    })
    .select()
    .single()

  if (saleError || !sale) throw new Error(saleError?.message ?? 'Failed to create sale')

  const saleItems = params.items.map(item => ({
    sale_id: sale.id,
    product_id: item.product.id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_amount: item.discount_amount,
    note: item.note || null,
    total: item.unit_price * item.quantity - item.discount_amount,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
  if (itemsError) throw new Error(itemsError.message)

  if (params.customerId) {
    await updateCustomerLoyalty(params.customerId, sale.id, params.total, params.loyaltyPointsRedeemed)
  }

  return sale as Sale
}

async function updateCustomerLoyalty(
  customerId: string,
  saleId: string,
  saleTotal: number,
  pointsRedeemed: number
) {
  const supabase = createClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('loyalty_points')
    .eq('id', customerId)
    .single()
  if (!customer) return

  const pointsEarned = calculateLoyaltyPoints(saleTotal)
  const newBalance = Math.max(0, (customer as any).loyalty_points + pointsEarned - pointsRedeemed)
  await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customerId)

  if (pointsEarned > 0) {
    await supabase.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      points: pointsEarned,
      type: 'earn',
      note: `Sale ${saleId.slice(0, 8).toUpperCase()}`,
    })
  }
  if (pointsRedeemed > 0) {
    await supabase.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      points: -pointsRedeemed,
      type: 'redeem',
      note: `Redeemed at sale ${saleId.slice(0, 8).toUpperCase()}`,
    })
  }
}

export async function voidSale(saleId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('sales').update({ status: 'voided' }).eq('id', saleId)
}
