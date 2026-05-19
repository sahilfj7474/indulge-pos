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
          'px-4 py-2.5 rounded-full text-sm font-medium transition-colors active:scale-95',
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
            'px-4 py-2.5 rounded-full text-sm font-medium transition-colors active:scale-95',
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