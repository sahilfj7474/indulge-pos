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
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-slate-500 hover:text-slate-800 hover:bg-blue-100'
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
              : 'bg-blue-50 text-slate-500 hover:text-slate-800 hover:bg-blue-100'
          )}
          style={selected === cat.id ? { backgroundColor: cat.color ?? '#6366f1' } : undefined}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}