'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getNavItems } from '@/lib/permissions'
import {
  ShoppingCart, Receipt, Users, Package, Warehouse,
  BarChart2, MapPin, UserCog, Settings, LogOut,
  DollarSign, BookOpen, ClipboardList, ArrowLeftRight,
  Truck, ShoppingBag, PauseCircle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, React.ElementType> = {
  ShoppingCart, Receipt, Users, Package, Warehouse,
  BarChart2, MapPin, UserCog, Settings,
  DollarSign, BookOpen, ClipboardList, ArrowLeftRight,
  Truck, ShoppingBag, PauseCircle, Zap,
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  if (!user) return null

  const navItems = getNavItems(user.role)
  const sidebarItems = navItems.filter(i => i.label !== 'Held Orders')
  const groups = Array.from(new Set(sidebarItems.map(i => i.group ?? 'Other')))

  return (
    <aside className="w-56 bg-blue-900 flex flex-col">
      {/* Logo / branding */}
      <div className="px-5 py-4 border-b border-blue-800">
        <h1 className="text-lg font-bold text-white tracking-tight">Indulge POS</h1>
        <p className="text-xs text-blue-300 mt-0.5">{user.location?.name ?? 'No Location'}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto px-2">
        {groups.map(group => {
          const items = sidebarItems.filter(i => (i.group ?? 'Other') === group)
          return (
            <div key={group} className="mb-3">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                {group}
              </p>
              {items.map(item => {
                const Icon = ICONS[item.icon]
                const active = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-200 hover:text-white hover:bg-blue-800'
                    )}
                  >
                    {Icon && <Icon size={16} />}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User info + sign out */}
      <div className="px-2 pb-4 border-t border-blue-800 pt-3">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
          <p className="text-xs text-blue-300 capitalize">{user.role}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-blue-300 hover:text-white hover:bg-blue-800 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
