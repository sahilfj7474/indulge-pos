import { createClient } from '@/lib/supabase/client'
import { Product, Category, Location, User } from '@/types'

// ── Categories ──────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data } = await supabase.from('categories').select('*').order('name')
  return (data ?? []) as Category[]
}

export async function createCategory(data: { name: string; color: string }): Promise<Category> {
  const supabase = createClient()
  const { data: created, error } = await supabase.from('categories').insert(data).select().single()
  if (error) throw new Error(error.message)
  return created as Category
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('categories').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Products ─────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('name')
  return (data ?? []) as unknown as Product[]
}

export async function createProduct(data: {
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  price: number
  cost: number | null
  is_active: boolean
  image_url?: string | null
}): Promise<Product> {
  const supabase = createClient()
  const { data: created, error } = await supabase.from('products').insert(data).select('*, category:categories(*)').single()
  if (error) throw new Error(error.message)
  return created as unknown as Product
}

export async function updateProduct(id: string, data: Partial<{
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  price: number
  cost: number | null
  is_active: boolean
  image_url: string | null
}>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Locations ────────────────────────────────────────────────

export async function getLocations(): Promise<Location[]> {
  const supabase = createClient()
  const { data } = await supabase.from('locations').select('*').order('name')
  return (data ?? []) as Location[]
}

export async function createLocation(data: { name: string; address: string | null; phone: string | null }): Promise<Location> {
  const supabase = createClient()
  const { data: created, error } = await supabase.from('locations').insert(data).select().single()
  if (error) throw new Error(error.message)
  return created as Location
}

export async function updateLocation(id: string, data: Partial<Location>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('locations').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Users ────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('*, location:locations(*)')
    .order('full_name')
  return (data ?? []) as unknown as User[]
}

export async function updateUser(id: string, data: Partial<{
  full_name: string
  role: string
  location_id: string | null
  is_active: boolean
}>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('users').update(data).eq('id', id)
  if (error) throw new Error(error.message)
}
