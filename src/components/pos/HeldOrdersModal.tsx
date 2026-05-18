'use client'

import { HeldOrderRecord, deleteHeldOrder } from '@/lib/services/held-orders.service'
import { formatDateTime } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { PlayCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  orders: HeldOrderRecord[]
  onResume: (order: HeldOrderRecord) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

export default function HeldOrdersModal({ orders, onResume, onDeleted, onClose }: Props) {
  async function handleDelete(id: string) {
    await deleteHeldOrder(id)
    toast.success('Held order deleted')
    onDeleted(id)
  }

  return (
    <Modal title="Held Orders" onClose={onClose}>
      {orders.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">No held orders</p>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-medium text-sm truncate">{order.label}</p>
                <p className="text-slate-400 text-xs">
                  {order.data.items.length} item{order.data.items.length !== 1 ? 's' : ''} •{' '}
                  {formatDateTime(order.created_at)}
                </p>
                {order.data.customer && (
                  <p className="text-blue-500 text-xs">{order.data.customer.full_name}</p>
                )}
              </div>
              <button
                onClick={() => { onResume(order); onClose() }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <PlayCircle size={13} /> Resume
              </button>
              <button
                onClick={() => handleDelete(order.id)}
                className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}