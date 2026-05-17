import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data } = await supabase.from('categories').select('*').order('name')
  return (data ?? []) as Category[]
}

export async function getActiveProducts(locationId: string): Promise<Product[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*), inventory!inner(quantity, location_id)')
    .eq('is_active', true)
    .eq('inventory.location_id', locationId)
    .order('name')
  return (data ?? []) as unknown as Product[]
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('barcode', barcode)
    .eq('is_active', true)
    .single()
  return data as Product | null
}

export async function searchProducts(query: string, locationId: string): Promise<Product[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
    .order('name')
    .limit(20)
  return (data ?? []) as unknown as Product[]
}
