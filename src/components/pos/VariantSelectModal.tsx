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
    <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-xs shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{product.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a variant</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {variants.map(v => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors text-left"
            >
              <span className="text-sm font-medium text-slate-900">{v.name}</span>
              <span className="text-sm text-blue-500 font-semibold">
                {formatCurrency(v.price_override ?? product.price)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}