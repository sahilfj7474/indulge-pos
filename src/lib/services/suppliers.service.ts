import { createClient } from '@/lib/supabase/client'
import { Supplier } from '@/types'

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = createClient()
  const { data } = await supabase.from('suppliers').select('*').order('name')
  return (data ?? []) as Supplier[]
}

export async function createSupplier(payload: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
  const supabase = createClient()
  const { data, error } = await supabase.from('suppliers').insert(payload).select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create supplier')
  return data as Supplier
}

export async function updateSupplier(id: string, payload: Partial<Supplier>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('suppliers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSupplier(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('suppliers').delete().eq('id', id)
}
