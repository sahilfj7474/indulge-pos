'use client'

import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'

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
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 rounded-lg p-3 text-left transition-all group"
        >
          <div
            className="w-full h-1.5 rounded-full mb-2 opacity-70"
            style={{ backgroundColor: product.category?.color ?? '#6366f1' }}
          />
          <p className="text-sm font-medium text-white leading-tight line-clamp-2 group-hover:text-indigo-300">
            {product.name}
          </p>
          {product.sku && (
            <p className="text-xs text-gray-500 mt-0.5">{product.sku}</p>
          )}
          <p className="text-sm font-bold text-indigo-400 mt-1.5">
            {formatCurrency(product.price)}
          </p>
        </button>
      ))}
    </div>
  )
}
