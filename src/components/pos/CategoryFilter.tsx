'use client'

import { Category } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  categories: Category[]
  selected: string | null
  onSelect: (id: string | null) => void
}

export default function CategoryFilter({ categories, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selected === null
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
        )}
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            selected === cat.id
              ? 'text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          )}
          style={selected === cat.id ? { backgroundColor: cat.color ?? '#6366f1' } : undefined}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
