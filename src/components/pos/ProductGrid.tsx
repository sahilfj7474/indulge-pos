'use client'

import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Package } from 'lucide-react'

interface Props {
  products: Product[]
  onAdd: (product: Product) => void
}

export default function ProductGrid({ products, onAdd }: Props) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No products found
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 xl:grid-cols-4 gap-2.5">
      {products.map(product => (
        <button
          key={product.id}
          onClick={() => onAdd(product)}
          className="bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 hover:border-blue-500 rounded-xl overflow-hidden text-left transition-all group flex flex-col active:scale-[0.97]"
        >
          {/* Image */}
          <div className="w-full h-32 bg-white flex items-center justify-center overflow-hidden relative">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400 w-full h-full bg-blue-50 justify-center">
                <div className="w-full h-1 absolute top-0" style={{ backgroundColor: product.category?.color ?? '#6366f1', opacity: 0.7 }} />
                <Package size={28} className="opacity-30" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-2.5 flex-1 flex flex-col">
            <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2 group-hover:text-blue-600 flex-1">
              {product.name}
            </p>
            {product.sku && <p className="text-xs text-slate-400 mt-0.5">{product.sku}</p>}
            <p className="text-base font-bold text-blue-500 mt-1.5">
              {formatCurrency(product.price)}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
