import { createClient } from '@/lib/supabase/client'

export interface ProductVariant {
  id: string
  parent_product_id: string
  name: string
  sku: string | null
  barcode: string | null
  price_override: number | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface BundleItem {
  id: string
  bundle_product_id: string
  component_product_id: string
  quantity: number
  component?: { id: string; name: string; price: number }
}

export async function getVariants(parentProductId: string): Promise<ProductVariant[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('parent_product_id', parentProductId)
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as ProductVariant[]
}

export async function createVariant(data: Omit<ProductVariant, 'id' | 'created_at'>): Promise<ProductVariant> {
  const supabase = createClient()
  const { data: created, error } = await supabase.from('product_variants').insert(data).select().single()
  if (error) throw new Error(error.message)
  return created as ProductVariant
}

export async function updateVariant(id: string, data: Partial<Omit<ProductVariant, 'id' | 'created_at'>>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('product_variants').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteVariant(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getBundleItems(bundleProductId: string): Promise<BundleItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('product_bundles')
    .select('*, component:products!component_product_id(id, name, price)')
    .eq('bundle_product_id', bundleProductId)
  return (data ?? []) as unknown as BundleItem[]
}

export async function setBundleItems(bundleProductId: string, items: { component_product_id: string; quantity: number }[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('product_bundles').delete().eq('bundle_product_id', bundleProductId)
  if (items.length > 0) {
    await supabase.from('product_bundles').insert(
      items.map(i => ({ bundle_product_id: bundleProductId, ...i }))
    )
  }
}
