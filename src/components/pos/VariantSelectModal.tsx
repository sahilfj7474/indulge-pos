'use client'

import { Product } from '@/types'
import { ProductVariant } from '@/lib/services/variants.service'
import { formatCurrency } from '@/lib/utils'
import { X } from 'lucide-react'

interface Props {
  product: Product
  variants: ProductVariant[]
  onSelect: (variant: ProductVariant) => void
  onClose: () => void
}

export default function VariantSelectModal({ product, variants, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-xs shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">{product.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select a variant</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {variants.map(v => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-indigo-900/40 border border-gray-700 hover:border-indigo-600 rounded-lg transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">{v.name}</span>
              <span className="text-sm text-indigo-400 font-semibold">
                {formatCurrency(v.price_override ?? product.price)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
