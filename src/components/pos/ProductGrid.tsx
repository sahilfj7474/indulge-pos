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
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No products found
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
      {products.map(product => (
        <button
          key={product.id}
          onClick={() => onAdd(product)}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 rounded-lg overflow-hidden text-left transition-all group flex flex-col"
        >
          {/* Image */}
          <div className="w-full h-24 bg-gray-750 flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-600">
                <div className="w-full h-1 absolute top-0" style={{ backgroundColor: product.category?.color ?? '#6366f1', opacity: 0.7 }} />
                <Package size={24} className="opacity-30" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-2 flex-1 flex flex-col">
            <p className="text-xs font-medium text-white leading-tight line-clamp-2 group-hover:text-indigo-300 flex-1">
              {product.name}
            </p>
            {product.sku && <p className="text-xs text-gray-600 mt-0.5">{product.sku}</p>}
            <p className="text-sm font-bold text-indigo-400 mt-1">
              {formatCurrency(product.price)}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
