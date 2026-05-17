export type UserRole = 'cashier' | 'supervisor' | 'manager' | 'admin'

export interface Location {
  id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  location_id: string | null
  location?: Location
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  color: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  category?: Category
  price: number
  cost: number | null
  is_active: boolean
  created_at: string
}

export interface InventoryItem {
  id: string
  product_id: string
  location_id: string
  product?: Product
  location?: Location
  quantity: number
  low_stock_threshold: number
  updated_at: string
}

export interface InventoryAdjustment {
  id: string
  product_id: string
  location_id: string
  product?: Product
  user_id: string
  user?: User
  quantity_change: number
  reason: string | null
  created_at: string
}

export interface Customer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  loyalty_points: number
  total_spent: number
  created_at: string
}

export interface Sale {
  id: string
  location_id: string
  location?: Location
  user_id: string
  user?: User
  customer_id: string | null
  customer?: Customer
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_method: PaymentMethod
  notes: string | null
  status: SaleStatus
  created_at: string
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  discount_amount: number
  total: number
}

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'loyalty_points' | 'split'
export type SaleStatus = 'completed' | 'refunded' | 'partial_refund' | 'voided'

export interface Refund {
  id: string
  sale_id: string
  sale?: Sale
  user_id: string
  user?: User
  amount: number
  reason: string | null
  created_at: string
  items?: RefundItem[]
}

export interface RefundItem {
  id: string
  refund_id: string
  sale_item_id: string
  product_id: string
  product?: Product
  quantity: number
  amount: number
}

export interface LoyaltyTransaction {
  id: string
  customer_id: string
  sale_id: string | null
  points: number
  type: 'earn' | 'redeem' | 'adjustment'
  note: string | null
  created_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount_amount: number
}

export interface ZReport {
  location_id: string
  location_name: string
  date: string
  opened_by: string
  closed_by?: string
  total_sales: number
  total_transactions: number
  total_refunds: number
  net_sales: number
  total_discount: number
  total_tax: number
  cash_sales: number
  card_sales: number
  bank_transfer_sales: number
  loyalty_sales: number
  top_products: { name: string; qty: number; total: number }[]
}
