'use client'

import { useState, useEffect, useMemo } from 'react'
import { InventoryItem, InventoryAdjustment, Location } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { getInventory, getAdjustmentHistory } from '@/lib/services/inventory.service'
import { getLocations } from '@/lib/services/admin.service'
import { formatDateTime, cn } from '@/lib/utils'
import AdjustmentModal from '@/components/inventory/AdjustmentModal'
import SetStockModal from '@/components/inventory/SetStockModal'
import { AlertTriangle, Search, History, Package } from 'lucide-react'

export default function InventoryPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<InventoryAdjustment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'ok'>('all')
  const [tab, setTab] = useState<'stock' | 'history'>('stock')
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)
  const [settingStock, setSettingStock] = useState<InventoryItem | null>(null)

  const effectiveLocationId = selectedLocationId || user?.location_id || ''

  useEffect(() => {
    if (!isManager) return
    getLocations().then(locs => {
      const active = locs.filter(l => l.is_active !== false)
      setLocations(active)
      if (!selectedLocationId && active.length > 0) {
        setSelectedLocationId(user?.location_id ?? active[0].id)
      }
    })
  }, [isManager])

  async function load() {
    if (!effectiveLocationId) return
    setLoading(true)
    const [inv, hist] = await Promise.all([
      getInventory(effectiveLocationId),
      getAdjustmentHistory(effectiveLocationId),
    ])
    setInventory(inv)
    setHistory(hist)
    setLoading(false)
  }

  useEffect(() => {
    if (effectiveLocationId) load()
  }, [effectiveLocationId])

  const filtered = useMemo(() => {
    return inventory.filter(item => {
      const name = item.product?.name?.toLowerCase() ?? ''
      if (search && !name.includes(search.toLowerCase())) return false
      if (filter === 'low' && item.quantity >= item.low_stock_threshold) return false
      if (filter === 'ok'  && item.quantity < item.low_stock_threshold) return false
      return true
    })
  }, [inventory, search, filter])

  const lowStockCount = inventory.filter(i => i.quantity < i.low_stock_threshold).length
  const currentLocationName = isManager
    ? locations.find(l => l.id === effectiveLocationId)?.name ?? ''
    : user?.location?.name ?? ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {inventory.length} products tracked
            {currentLocationName && <span className="text-gray-600"> · {currentLocationName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isManager && locations.length > 1 && (
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/40 border border-amber-700 rounded-lg">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-sm text-amber-400">{lowStockCount} low stock</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit border border-gray-800">
        {([['stock', Package], ['history', History]] as const).map(([t, Icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
              tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            <Icon size={14} />{t === 'stock' ? 'Stock Levels' : 'Adjustment History'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
              {(['all', 'low', 'ok'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    filter === f ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {f === 'low' ? 'Low Stock' : f === 'ok' ? 'In Stock' : 'All'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">In Stock</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Alert At</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500">No products found</td></tr>
                ) : filtered.map(item => {
                  const isLow = item.quantity < item.low_stock_threshold
                  return (
                    <tr key={item.id} className={cn('border-b border-gray-800/50 transition-colors', isLow ? 'bg-amber-950/10' : 'hover:bg-gray-800/30')}>
                      <td className="px-4 py-3 font-medium text-white">{item.product?.name}</td>
                      <td className="px-4 py-3">
                        {item.product?.category ? (
                          <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: item.product.category.color ?? '#6366f1' }}>
                            {item.product.category.name}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-bold text-lg', isLow ? 'text-amber-400' : 'text-white')}>
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{item.low_stock_threshold}</td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="flex items-center justify-center gap-1 text-amber-400 text-xs">
                            <AlertTriangle size={11} /> Low
                          </span>
                        ) : (
                          <span className="text-green-400 text-xs">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSettingStock(item)}
                            title="Set stock level"
                            className="px-2.5 py-1 bg-gray-800 hover:bg-indigo-900/50 hover:text-indigo-300 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                          >
                            Set
                          </button>
                          <button
                            onClick={() => setAdjusting(item)}
                            title="Adjust stock (add or remove)"
                            className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                          >
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">By</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Change</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">No adjustments yet</td></tr>
              ) : history.map(adj => (
                <tr key={adj.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(adj.created_at)}</td>
                  <td className="px-4 py-3 text-white">{(adj as any).product?.name}</td>
                  <td className="px-4 py-3 text-gray-400">{(adj as any).user?.full_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('font-bold', adj.quantity_change > 0 ? 'text-green-400' : 'text-red-400')}>
                      {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{adj.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && user && (
        <AdjustmentModal
          item={adjusting}
          userId={user.id}
          onClose={() => setAdjusting(null)}
          onSaved={load}
        />
      )}

      {settingStock && user && (
        <SetStockModal
          item={settingStock}
          userId={user.id}
          onClose={() => setSettingStock(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
