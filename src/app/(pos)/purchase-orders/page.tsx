'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePOStatus, receivePurchaseOrder
} from '@/lib/services/purchase-orders.service'
import { getSuppliers } from '@/lib/services/suppliers.service'
import { getActiveProducts } from '@/lib/services/products.service'
import { PurchaseOrder, Supplier, Product } from '@/types'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, ChevronRight, Package, X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-700 text-gray-400',
  ordered:   'bg-blue-900/50 text-blue-400',
  received:  'bg-green-900/50 text-green-400',
  cancelled: 'bg-red-900/50 text-red-400',
}

const STATUS_FLOW = { draft: 'ordered', ordered: 'received' } as Record<string, string>

export default function PurchaseOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Selected PO detail
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({})

  // New PO form
  const [showNew, setShowNew] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<{ product_id: string; quantity_ordered: number; unit_cost: number }[]>([
    { product_id: '', quantity_ordered: 1, unit_cost: 0 }
  ])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!user?.location_id) return
    setLoading(true)
    const [pos, sups, prods] = await Promise.all([
      getPurchaseOrders(user.location_id),
      getSuppliers(),
      getActiveProducts(user.location_id),
    ])
    setOrders(pos)
    setSuppliers(sups)
    setProducts(prods)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function openDetail(po: PurchaseOrder) {
    setLoadingDetail(true)
    const detail = await getPurchaseOrder(po.id)
    setDetailPO(detail)
    if (detail?.items) {
      setReceivedQtys(Object.fromEntries(detail.items.map(i => [i.id, String(i.quantity_received)])))
    }
    setLoadingDetail(false)
  }

  async function handleCreate() {
    if (!supplierId) { toast.error('Select a supplier'); return }
    const validItems = poItems.filter(i => i.product_id && i.quantity_ordered > 0)
    if (validItems.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await createPurchaseOrder(supplierId, user!.location_id!, user!.id, poNotes, validItems)
      toast.success('Purchase order created')
      setShowNew(false)
      setSupplierId('')
      setPoNotes('')
      setPoItems([{ product_id: '', quantity_ordered: 1, unit_cost: 0 }])
      load()
    } catch { toast.error('Failed to create PO') } finally { setSaving(false) }
  }

  async function handleStatusChange(po: PurchaseOrder, newStatus: string) {
    try {
      await updatePOStatus(po.id, newStatus as PurchaseOrder['status'])
      toast.success(`Status updated to ${newStatus}`)
      load()
      if (detailPO?.id === po.id) openDetail(po)
    } catch { toast.error('Failed to update status') }
  }

  async function handleReceive() {
    if (!detailPO?.items) return
    const items = detailPO.items.map(i => ({
      id: i.id,
      product_id: i.product_id,
      quantity_received: parseInt(receivedQtys[i.id] ?? '0') || 0,
    }))
    try {
      await receivePurchaseOrder(detailPO.id, user!.location_id!, user!.id, items)
      toast.success('Inventory updated — PO marked received')
      setDetailPO(null)
      load()
    } catch { toast.error('Failed to receive PO') }
  }

  const poTotal = poItems.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Purchase Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus size={14} /> New PO
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">PO #</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Total</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">No purchase orders yet</td></tr>
            ) : orders.map(po => (
              <tr key={po.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => openDetail(po)}>
                <td className="px-4 py-3 font-mono text-indigo-400 text-xs">{po.id.slice(0,8).toUpperCase()}</td>
                <td className="px-4 py-3 text-white">{(po.supplier as unknown as { name: string })?.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(po.created_at)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{formatCurrency(po.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[po.status])}>
                    {po.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New PO Modal */}
      {showNew && (
        <Modal title="New Purchase Order" onClose={() => setShowNew(false)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Supplier *</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input type="text" value={poNotes} onChange={e => setPoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Items</label>
                <button onClick={() => setPoItems(prev => [...prev, { product_id: '', quantity_ordered: 1, unit_cost: 0 }])}
                  className="text-xs text-indigo-400 hover:text-indigo-300">+ Add item</button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
                  <span className="col-span-6">Product</span><span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Unit Cost</span>
                </div>
                {poItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <select value={item.product_id} onChange={e => setPoItems(prev => { const u=[...prev]; u[i]={...u[i],product_id:e.target.value}; return u })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Select product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min={1} value={item.quantity_ordered} onChange={e => setPoItems(prev => { const u=[...prev]; u[i]={...u[i],quantity_ordered:parseInt(e.target.value)||1}; return u })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min={0} step="0.01" value={item.unit_cost} onChange={e => setPoItems(prev => { const u=[...prev]; u[i]={...u[i],unit_cost:parseFloat(e.target.value)||0}; return u })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="col-span-1 flex items-center">
                      {poItems.length > 1 && (
                        <button onClick={() => setPoItems(prev => prev.filter((_,j)=>j!==i))} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-right text-sm text-gray-400 mt-2">
                Order Total: <span className="text-white font-bold">{formatCurrency(poTotal)}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {saving ? 'Creating...' : 'Create PO'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* PO Detail Modal */}
      {detailPO && (
        <Modal title={`PO — ${detailPO.id.slice(0,8).toUpperCase()}`} onClose={() => setDetailPO(null)} maxWidth="max-w-2xl">
          {loadingDetail ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Supplier</p><p className="text-white">{(detailPO.supplier as unknown as { name: string })?.name}</p></div>
                <div><p className="text-gray-500">Date</p><p className="text-white">{formatDateTime(detailPO.created_at)}</p></div>
                <div><p className="text-gray-500">Status</p>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[detailPO.status])}>
                    {detailPO.status}
                  </span>
                </div>
                <div><p className="text-gray-500">Total</p><p className="text-white font-bold">{formatCurrency(detailPO.total)}</p></div>
              </div>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-3 py-2 text-gray-400">Product</th>
                      <th className="text-right px-3 py-2 text-gray-400">Ordered</th>
                      <th className="text-right px-3 py-2 text-gray-400">Cost</th>
                      <th className="text-right px-3 py-2 text-gray-400">Total</th>
                      {detailPO.status === 'ordered' && <th className="text-right px-3 py-2 text-gray-400">Received</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(detailPO.items ?? []).map(item => (
                      <tr key={item.id} className="border-b border-gray-700/50">
                        <td className="px-3 py-2 text-white">{(item.product as unknown as { name: string })?.name}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{item.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-3 py-2 text-right text-white">{formatCurrency(item.total)}</td>
                        {detailPO.status === 'ordered' && (
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" min={0} max={item.quantity_ordered}
                              value={receivedQtys[item.id] ?? ''}
                              onChange={e => setReceivedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 flex-wrap">
                {detailPO.status === 'draft' && (
                  <>
                    <button onClick={() => handleStatusChange(detailPO, 'ordered')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
                      <Package size={14} /> Mark as Ordered
                    </button>
                    <button onClick={() => handleStatusChange(detailPO, 'cancelled')}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-sm font-medium rounded-lg">
                      Cancel PO
                    </button>
                  </>
                )}
                {detailPO.status === 'ordered' && (
                  <button onClick={handleReceive}
                    className="flex items-center gap-2 px-4 py-2 bg-green-800 hover:bg-green-700 text-white text-sm font-bold rounded-lg">
                    <CheckCircle size={14} /> Receive & Update Inventory
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
