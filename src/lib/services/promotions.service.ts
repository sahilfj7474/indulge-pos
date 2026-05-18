import { createClient } from '@/lib/supabase/client'
import { CartItem } from '@/types'

export interface Promotion {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  discount_value: number
  applies_to: 'all' | 'category' | 'product'
  category_id: string | null
  product_id: string | null
  min_purchase: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
}

export async function getPromotions(): Promise<Promotion[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as Promotion[]
}

export async function getActivePromotions(): Promise<Promotion[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
  return (data ?? []) as Promotion[]
}

export async function createPromotion(data: Omit<Promotion, 'id' | 'created_at'>): Promise<Promotion> {
  const supabase = createClient()
  const { data: created, error } = await supabase.from('promotions').insert(data).select().single()
  if (error) throw new Error(error.message)
  return created as Promotion
}

export async function updatePromotion(id: string, data: Partial<Omit<Promotion, 'id' | 'created_at'>>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('promotions').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePromotion(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('promotions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Apply active promotions to cart items, returns per-item discount amounts and promo name
export function applyPromotions(
  items: CartItem[],
  promotions: Promotion[],
  subtotal: number
): { itemDiscounts: number[]; appliedPromo: string | null } {
  if (!promotions.length || !items.length) return { itemDiscounts: items.map(() => 0), appliedPromo: null }

  // Find best applicable promotion
  let bestPromo: Promotion | null = null
  let bestDiscount = 0

  for (const promo of promotions) {
    if (subtotal < promo.min_purchase) continue

    let promoDiscount = 0

    if (promo.applies_to === 'all') {
      promoDiscount = promo.type === 'percentage'
        ? (subtotal * promo.discount_value) / 100
        : Math.min(promo.discount_value, subtotal)
    } else if (promo.applies_to === 'category' && promo.category_id) {
      const catSubtotal = items
        .filter(i => i.product.category_id === promo.category_id)
        .reduce((s, i) => s + i.unit_price * i.quantity, 0)
      promoDiscount = promo.type === 'percentage'
        ? (catSubtotal * promo.discount_value) / 100
        : Math.min(promo.discount_value, catSubtotal)
    } else if (promo.applies_to === 'product' && promo.product_id) {
      const prodSubtotal = items
        .filter(i => i.product.id === promo.product_id)
        .reduce((s, i) => s + i.unit_price * i.quantity, 0)
      promoDiscount = promo.type === 'percentage'
        ? (prodSubtotal * promo.discount_value) / 100
        : Math.min(promo.discount_value, prodSubtotal)
    }

    if (promoDiscount > bestDiscount) {
      bestDiscount = promoDiscount
      bestPromo = promo
    }
  }

  if (!bestPromo || bestDiscount === 0) return { itemDiscounts: items.map(() => 0), appliedPromo: null }

  // Distribute discount proportionally across applicable items
  const itemDiscounts = items.map(item => {
    const lineTotal = item.unit_price * item.quantity
    let applicable = false

    if (bestPromo!.applies_to === 'all') applicable = true
    else if (bestPromo!.applies_to === 'category') applicable = item.product.category_id === bestPromo!.category_id
    else if (bestPromo!.applies_to === 'product') applicable = item.product.id === bestPromo!.product_id

    if (!applicable) return 0

    const applicableTotal = items
      .filter(i => {
        if (bestPromo!.applies_to === 'all') return true
        if (bestPromo!.applies_to === 'category') return i.product.category_id === bestPromo!.category_id
        return i.product.id === bestPromo!.product_id
      })
      .reduce((s, i) => s + i.unit_price * i.quantity, 0)

    return applicableTotal > 0 ? (lineTotal / applicableTotal) * bestDiscount : 0
  })

  return { itemDiscounts, appliedPromo: bestPromo.name }
}
