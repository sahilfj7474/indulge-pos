'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { Location } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  locations:   Location[]
  selectedIds: string[]   // [] = All Stores
  onChange:    (ids: string[]) => void
}

export default function MultiLocationPicker({ locations, selectedIds, onChange }: Props) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [pos,    setPos]    = useState({ top: 0, left: 0 })

  const buttonRef   = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
      setSearch('')
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function openDropdown() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
    setSearch('')
  }

  const isAllStores = selectedIds.length === 0

  const label = isAllStores
    ? 'All Stores'
    : selectedIds.length === 1
    ? (locations.find(l => l.id === selectedIds[0])?.name ?? '1 Store')
    : `${selectedIds.length} Stores`

  const filtered = search
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations

  function toggleAll() {
    onChange([]) // empty = all stores
  }

  function toggleLocation(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openDropdown}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg text-blue-700 text-sm font-semibold hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
      >
        <MapPin size={13} className="text-blue-500 shrink-0" />
        <span className="uppercase text-xs tracking-wider">{label}</span>
        {!isAllStores && (
          <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-bold leading-none">
            {selectedIds.length}
          </span>
        )}
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-blue-100 rounded-xl shadow-2xl w-64 overflow-hidden"
        >
          {/* Search */}
          {locations.length >= 4 && (
            <div className="p-2 border-b border-blue-50">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find store..."
                className="w-full px-3 py-1.5 text-sm bg-blue-50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder-slate-400"
              />
            </div>
          )}

          <div className="py-1 max-h-72 overflow-y-auto">
            {/* All Stores */}
            {!search && (
              <button
                onClick={toggleAll}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-blue-50',
                  isAllStores ? 'text-blue-600 font-semibold' : 'text-slate-700'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  isAllStores ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                )}>
                  {isAllStores && <Check size={9} strokeWidth={3} className="text-white" />}
                </div>
                All Stores
              </button>
            )}

            {/* Individual locations */}
            {filtered.map(l => {
              const checked = selectedIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLocation(l.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-blue-50',
                    checked ? 'text-blue-600 font-semibold' : 'text-slate-700'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                  )}>
                    {checked && <Check size={9} strokeWidth={3} className="text-white" />}
                  </div>
                  {l.name}
                </button>
              )
            })}

            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">No stores found</p>
            )}
          </div>

          {/* Clear footer */}
          {!isAllStores && (
            <div className="px-4 py-2 border-t border-blue-50 flex justify-between items-center">
              <span className="text-xs text-slate-400">{selectedIds.length} selected</span>
              <button
                onClick={toggleAll}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
