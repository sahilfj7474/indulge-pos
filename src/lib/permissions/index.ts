import { UserRole } from '@/types'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  cashier: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function canVoidSale(role: UserRole)       { return hasRole(role, 'supervisor') }
export function canApplyDiscount(role: UserRole)   { return hasRole(role, 'cashier') }
export function canManageProducts(role: UserRole)  { return hasRole(role, 'manager') }
export function canManageUsers(role: UserRole)     { return hasRole(role, 'admin') }
export function canManageLocations(role: UserRole) { return hasRole(role, 'admin') }
export function canViewAllLocations(role: UserRole){ return hasRole(role, 'manager') }
export function canViewReports(role: UserRole)     { return hasRole(role, 'supervisor') }
export function canAdjustInventory(role: UserRole) { return hasRole(role, 'supervisor') }
export function canManageSuppliers(role: UserRole) { return hasRole(role, 'manager') }
export function canManagePO(role: UserRole)        { return hasRole(role, 'manager') }
export function canDoStockTake(role: UserRole)     { return hasRole(role, 'supervisor') }

export interface NavItem {
  label: string
  href: string
  icon: string
  minRole: UserRole
  group?: string
}

export const NAV_ITEMS: NavItem[] = [
  // POS
  { label: 'POS',              href: '/pos',              icon: 'ShoppingCart',  minRole: 'cashier',    group: 'POS' },
  { label: 'Register',         href: '/register',         icon: 'DollarSign',    minRole: 'cashier',    group: 'POS' },
  { label: 'Held Orders',      href: '/pos',              icon: 'PauseCircle',   minRole: 'cashier',    group: 'POS' },
  // Sales
  { label: 'Sales',            href: '/sales',            icon: 'Receipt',       minRole: 'cashier',    group: 'Sales' },
  { label: 'Laybys',           href: '/laybys',           icon: 'BookOpen',      minRole: 'cashier',    group: 'Sales' },
  { label: 'Customers',        href: '/customers',        icon: 'Users',         minRole: 'cashier',    group: 'Sales' },
  // Inventory
  { label: 'Inventory',        href: '/inventory',        icon: 'Warehouse',     minRole: 'supervisor', group: 'Inventory' },
  { label: 'Stock Takes',      href: '/stock-takes',      icon: 'ClipboardList', minRole: 'supervisor', group: 'Inventory' },
  { label: 'Stock Transfers',  href: '/stock-transfers',  icon: 'ArrowLeftRight',minRole: 'supervisor', group: 'Inventory' },
  // Products & Purchasing
  { label: 'Products',         href: '/products',         icon: 'Package',       minRole: 'manager',    group: 'Catalog' },
  { label: 'Suppliers',        href: '/suppliers',        icon: 'Truck',         minRole: 'manager',    group: 'Catalog' },
  { label: 'Purchase Orders',  href: '/purchase-orders',  icon: 'ShoppingBag',   minRole: 'manager',    group: 'Catalog' },
  // Reports & Admin
  { label: 'Reports',          href: '/reports',          icon: 'BarChart2',     minRole: 'supervisor', group: 'Reports' },
  { label: 'Locations',        href: '/admin/locations',  icon: 'MapPin',        minRole: 'admin',      group: 'Admin' },
  { label: 'Users',            href: '/admin/users',      icon: 'UserCog',       minRole: 'admin',      group: 'Admin' },
  { label: 'Settings',         href: '/admin/settings',   icon: 'Settings',      minRole: 'admin',      group: 'Admin' },
]

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter(item => hasRole(role, item.minRole))
}
