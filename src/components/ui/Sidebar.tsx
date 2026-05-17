'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getNavItems } from '@/lib/permissions'
import {
  ShoppingCart, Receipt, Users, Package, Warehouse,
  BarChart2, MapPin, UserCog, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, React.ElementType> = {
  ShoppingCart, Receipt, Users, Package, Warehouse,
  BarChart2, MapPin, UserCog, Settings,
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  if (!user) return null

  const navItems = getNavItems(user.role)

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">Indulge POS</h1>
        <p className="text-xs text-gray-400 mt-0.5">{user.location?.name ?? 'No Location'}</p>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(item => {
          const Icon = ICONS[item.icon]
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {Icon && <Icon size={17} />}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 pb-4 border-t border-gray-800 pt-3">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
          <p className="text-xs text-gray-400 capitalize">{user.role}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
