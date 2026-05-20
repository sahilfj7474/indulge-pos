import { UserRole } from '@/types'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  cashier: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
}

// ─── Granular permission tree ──────────────────────────────────────────────────

export interface PermNode {
  label: string
  description?: string
}

export interface PermGroup {
  label: string
  icon?: string
  children: Record<string, PermNode>
}

export const PERMISSION_TREE: Record<string, PermGroup> = {
  pos: {
    label: 'Point of Sale',
    children: {
      process_sale:    { label: 'Process sales' },
      apply_discount:  { label: 'Apply discounts to transactions' },
      void_sale:       { label: 'Void & refund sales' },
      view_sales:      { label: 'View sales history' },
      manage_register: { label: 'Open & close register (X/Z reports)' },
    },
  },
  products: {
    label: 'Products',
    children: {
      view:            { label: 'View products & catalog' },
      create:          { label: 'Create new products' },
      edit:            { label: 'Edit existing products' },
      delete:          { label: 'Delete products' },
      manage_pricing:  { label: 'Manage pricing, margin & costs' },
      view_cost:       { label: 'View cost prices' },
    },
  },
  inventory: {
    label: 'Inventory',
    children: {
      view:   { label: 'View inventory levels' },
      adjust: { label: 'Adjust & transfer stock' },
    },
  },
  customers: {
    label: 'Customers',
    children: {
      view:   { label: 'View customer list & profiles' },
      create: { label: 'Create & edit customers' },
      delete: { label: 'Delete customers' },
    },
  },
  reports: {
    label: 'Reports & Analytics',
    children: {
      view:   { label: 'View reports & dashboard' },
      export: { label: 'Export data to Excel' },
      zx:     { label: 'Print X & Z end-of-day reports' },
    },
  },
  admin: {
    label: 'Administration',
    children: {
      users:     { label: 'Manage users & permissions' },
      locations: { label: 'Manage locations / outlets' },
      settings:  { label: 'System settings & receipt template' },
      groups:    { label: 'Customer groups & promotions' },
    },
  },
}

export type PermMap = Record<string, boolean>

export const ROLE_PERMISSION_DEFAULTS: Record<UserRole, PermMap> = {
  cashier: {
    'pos.process_sale': true,  'pos.apply_discount': true,
    'pos.void_sale': false,    'pos.view_sales': true,    'pos.manage_register': false,
    'products.view': false,    'products.create': false,  'products.edit': false,
    'products.delete': false,  'products.manage_pricing': false, 'products.view_cost': false,
    'inventory.view': false,   'inventory.adjust': false,
    'customers.view': true,    'customers.create': true,  'customers.delete': false,
    'reports.view': false,     'reports.export': false,   'reports.zx': false,
    'admin.users': false,      'admin.locations': false,  'admin.settings': false, 'admin.groups': false,
  },
  supervisor: {
    'pos.process_sale': true,  'pos.apply_discount': true,
    'pos.void_sale': true,     'pos.view_sales': true,    'pos.manage_register': true,
    'products.view': false,    'products.create': false,  'products.edit': false,
    'products.delete': false,  'products.manage_pricing': false, 'products.view_cost': false,
    'inventory.view': true,    'inventory.adjust': true,
    'customers.view': true,    'customers.create': true,  'customers.delete': false,
    'reports.view': true,      'reports.export': true,    'reports.zx': true,
    'admin.users': false,      'admin.locations': false,  'admin.settings': false, 'admin.groups': false,
  },
  manager: {
    'pos.process_sale': true,  'pos.apply_discount': true,
    'pos.void_sale': true,     'pos.view_sales': true,    'pos.manage_register': true,
    'products.view': true,     'products.create': true,   'products.edit': true,
    'products.delete': true,   'products.manage_pricing': true, 'products.view_cost': true,
    'inventory.view': true,    'inventory.adjust': true,
    'customers.view': true,    'customers.create': true,  'customers.delete': false,
    'reports.view': true,      'reports.export': true,    'reports.zx': true,
    'admin.users': false,      'admin.locations': false,  'admin.settings': true, 'admin.groups': true,
  },
  admin: {
    'pos.process_sale': true,  'pos.apply_discount': true,
    'pos.void_sale': true,     'pos.view_sales': true,    'pos.manage_register': true,
    'products.view': true,     'products.create': true,   'products.edit': true,
    'products.delete': true,   'products.manage_pricing': true, 'products.view_cost': true,
    'inventory.view': true,    'inventory.adjust': true,
    'customers.view': true,    'customers.create': true,  'customers.delete': true,
    'reports.view': true,      'reports.export': true,    'reports.zx': true,
    'admin.users': true,       'admin.locations': true,   'admin.settings': true, 'admin.groups': true,
  },
}

/** Returns resolved permissions: override takes precedence, then role defaults */
export function resolvePermissions(role: UserRole, override: PermMap | null): PermMap {
  const defaults = ROLE_PERMISSION_DEFAULTS[role] ?? {}
  if (!override) return defaults
  return { ...defaults, ...override }
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

export interface NavItem {
  label: string
  href: string
  icon: string
  minRole: UserRole
  group?: string
}

export const NAV_ITEMS: NavItem[] = [
  // Overview
  { label: 'Dashboard',       href: '/dashboard',       icon: 'LayoutDashboard', minRole: 'cashier',    group: 'Overview' },
  // POS
  { label: 'POS',             href: '/pos',             icon: 'ShoppingCart',    minRole: 'cashier',    group: 'POS' },
  { label: 'Register',        href: '/register',        icon: 'DollarSign',      minRole: 'cashier',    group: 'POS' },
  // Sales
  { label: 'Sales',           href: '/sales',           icon: 'Receipt',         minRole: 'cashier',    group: 'Sales' },
  { label: 'Customers',       href: '/customers',       icon: 'Users',           minRole: 'cashier',    group: 'Sales' },
  // Inventory
  { label: 'Inventory',       href: '/inventory',       icon: 'Warehouse',       minRole: 'supervisor', group: 'Inventory' },
  // Products
  { label: 'Products',        href: '/products',        icon: 'Package',         minRole: 'manager',    group: 'Catalog' },
  // Reports & Admin
  { label: 'Reports',         href: '/reports',         icon: 'BarChart2',       minRole: 'supervisor', group: 'Reports' },
  { label: 'Customer Groups',   href: '/admin/customer-groups',   icon: 'Layers',   minRole: 'manager', group: 'Admin' },
  { label: 'Receipt Template',  href: '/admin/receipt-template',  icon: 'FileText', minRole: 'manager', group: 'Admin' },
  { label: 'Locations',         href: '/admin/locations',         icon: 'MapPin',   minRole: 'admin',   group: 'Admin' },
  { label: 'Users',             href: '/admin/users',             icon: 'UserCog',  minRole: 'admin',   group: 'Admin' },
  { label: 'Settings',          href: '/admin/settings',          icon: 'Settings', minRole: 'admin',   group: 'Admin' },
]

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter(item => hasRole(role, item.minRole))
}
