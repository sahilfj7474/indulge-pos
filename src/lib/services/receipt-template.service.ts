import { createClient } from '@/lib/supabase/client'

export interface ReceiptTemplate {
  id: string
  name: string
  trading_name: string
  receipt_type_label: string
  number_prefix: string
  header_text: string
  footer_text: string
  // Display toggles
  show_logo: boolean
  show_address: boolean
  show_email: boolean
  show_phone: boolean
  show_sold_by: boolean
  show_barcode: boolean
  hide_discount_if_zero: boolean
  show_loyalty_points: boolean
  // Column / row labels
  label_item: string
  label_price: string
  label_subtotal: string
  label_discount: string
  label_tax: string
  label_total: string
  label_change: string
  label_cashier: string
  is_default: boolean
  created_at: string
}

export type ReceiptTemplateInput = Omit<ReceiptTemplate, 'id' | 'created_at'>

export const DEFAULT_TEMPLATE: ReceiptTemplateInput = {
  name:                'Default',
  trading_name:        'Indulge',
  receipt_type_label:  'TAX INVOICE/RECEIPT',
  number_prefix:       'Invoice#',
  header_text:         '',
  footer_text:         'Thank you for your purchase!',
  show_logo:           true,
  show_address:        true,
  show_email:          true,
  show_phone:          true,
  show_sold_by:        true,
  show_barcode:        false,
  hide_discount_if_zero: true,
  show_loyalty_points: false,
  label_item:          'Item',
  label_price:         'Price',
  label_subtotal:      'Subtotal',
  label_discount:      'Discount',
  label_tax:           'VAT',
  label_total:         'Total',
  label_change:        'Change',
  label_cashier:       'Served by',
  is_default:          true,
}

export async function getDefaultReceiptTemplate(): Promise<ReceiptTemplate | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('receipt_templates')
    .select('*')
    .eq('is_default', true)
    .maybeSingle()
  return data as ReceiptTemplate | null
}

export async function saveReceiptTemplate(
  id: string | null,
  data: ReceiptTemplateInput
): Promise<ReceiptTemplate> {
  const supabase = createClient()
  if (id) {
    const { data: updated, error } = await supabase
      .from('receipt_templates')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return updated as ReceiptTemplate
  }
  const { data: created, error } = await supabase
    .from('receipt_templates')
    .insert({ ...data, is_default: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return created as ReceiptTemplate
}
