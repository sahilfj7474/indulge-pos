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
  location_id: string | null      // primary / home location (used for POS terminal)
  location?: Location
  location_ids: string[] | null   // null = all locations; [id1,id2] = specific locations
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
  image_url: string | null
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

export interface CustomerGroup {
  id: string
  name: string
  discount_type: 'none' | 'flat_rate' | 'markup'
  discount_value: number
  is_default: boolean
  created_at: string
}

export interface Customer {
  id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  loyalty_points: number
  total_spent: number
  created_at: string
  // Extended fields
  gender: string | null
  date_of_birth: string | null
  company: string | null
  customer_tax_id: string | null
  customer_group_id: string | null
  customer_group?: CustomerGroup
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state_province: string | null
  country: string | null
  postal_code: string | null
  secondary_email: string | null
  customer_code: string | null
  notes: string | null
  tax_exempt: boolean
  marketing_opt_in: boolean
  account_limit: number
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

// Dynamic — any string ID is valid (e.g. 'cash', 'card', 'mpaisa', 'split', 'account')
export type PaymentMethod = string
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
  note: string
}

export interface HeldOrder {
  id: string
  label: string
  items: CartItem[]
  customer: Customer | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  loyaltyPointsToRedeem: number
  heldAt: string
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface PurchaseOrder {
  id: string
  supplier_id: string
  supplier?: Supplier
  location_id: string
  location?: Location
  user_id: string
  user?: User
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  notes: string | null
  total: number
  created_at: string
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  product?: Product
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  total: number
}

export interface StockTake {
  id: string
  location_id: string
  location?: Location
  user_id: string
  user?: User
  status: 'in_progress' | 'completed'
  notes: string | null
  created_at: string
  completed_at: string | null
  items?: StockTakeItem[]
}

export interface StockTakeItem {
  id: string
  stock_take_id: string
  product_id: string
  product?: Product
  expected_qty: number
  counted_qty: number
  variance: number
}

export interface StockTransfer {
  id: string
  from_location_id: string
  to_location_id: string
  from_location?: Location
  to_location?: Location
  user_id: string
  user?: User
  status: 'pending' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  stock_transfer_id: string
  product_id: string
  product?: Product
  quantity: number
}

export interface Register {
  id: string
  location_id: string
  user_id: string
  user?: User
  opening_float: number
  closing_float: number | null
  cash_in: number
  cash_out: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

export interface Layby {
  id: string
  location_id: string
  user_id: string
  customer_id: string
  customer?: Customer
  total: number
  deposit_paid: number
  balance_due: number
  status: 'active' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  items?: LaybyItem[]
  payments?: LaybyPayment[]
}

export interface LaybyItem {
  id: string
  layby_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  total: number
}

export interface LaybyPayment {
  id: string
  layby_id: string
  amount: number
  payment_method: PaymentMethod
  created_at: string
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
