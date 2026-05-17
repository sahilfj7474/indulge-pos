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

export function canVoidSale(role: UserRole) { return hasRole(role, 'supervisor') }
export function canApplyDiscount(role: UserRole) { return hasRole(role, 'cashier') }
export function canManageProducts(role: UserRole) { return hasRole(role, 'manager') }
export function canManageUsers(role: UserRole) { return hasRole(role, 'admin') }
export function canManageLocations(role: UserRole) { return hasRole(role, 'admin') }
export function canViewAllLocations(role: UserRole) { return hasRole(role, 'manager') }
export function canViewReports(role: UserRole) { return hasRole(role, 'supervisor') }
export function canAdjustInventory(role: UserRole) { return hasRole(role, 'supervisor') }

export interface NavItem {
  label: string
  href: string
  icon: string
  minRole: UserRole
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'POS',        href: '/pos',              icon: 'ShoppingCart', minRole: 'cashier' },
  { label: 'Sales',      href: '/sales',             icon: 'Receipt',      minRole: 'cashier' },
  { label: 'Customers',  href: '/customers',         icon: 'Users',        minRole: 'cashier' },
  { label: 'Products',   href: '/products',          icon: 'Package',      minRole: 'manager' },
  { label: 'Inventory',  href: '/inventory',         icon: 'Warehouse',    minRole: 'supervisor' },
  { label: 'Reports',    href: '/reports',           icon: 'BarChart2',    minRole: 'supervisor' },
  { label: 'Locations',  href: '/admin/locations',   icon: 'MapPin',       minRole: 'admin' },
  { label: 'Users',      href: '/admin/users',       icon: 'UserCog',      minRole: 'admin' },
  { label: 'Settings',   href: '/admin/settings',    icon: 'Settings',     minRole: 'admin' },
]

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter(item => hasRole(role, item.minRole))
}
