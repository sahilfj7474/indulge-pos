'use client'

import { useState, useRef, useEffect } from 'react'
import { Customer } from '@/types'
import { searchCustomers } from '@/lib/services/customers.service'
import { UserCircle, X, Search } from 'lucide-react'

interface Props {
  selected: Customer | null
  onSelect: (c: Customer | null) => void
}

export default function CustomerSearch({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const data = await searchCustomers(query)
      setResults(data)
      setOpen(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-indigo-900/40 border border-indigo-700 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <UserCircle size={16} className="text-indigo-400" />
          <div>
            <p className="text-sm font-medium text-white">{selected.full_name}</p>
            <p className="text-xs text-indigo-300">{selected.loyalty_points} pts available</p>
          </div>
        </div>
        <button onClick={() => onSelect(null)} className="text-gray-400 hover:text-white">
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Add customer (optional)"
          className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false) }}
              className="w-full px-3 py-2.5 text-left hover:bg-gray-700 transition-colors"
            >
              <p className="text-sm font-medium text-white">{c.full_name}</p>
              <p className="text-xs text-gray-400">{c.phone ?? c.email ?? ''} · {c.loyalty_points} pts</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
