'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { Location } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  locations:  Location[]
  selectedId: string   // '' = All Stores
  onChange:   (id: string) => void
}

export default function LocationPicker({ locations, selectedId, onChange }: Props) {
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

  const selectedName = selectedId === ''
    ? 'All Stores'
    : (locations.find(l => l.id === selectedId)?.name ?? 'All Stores')

  const filtered = search
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openDropdown}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg text-blue-700 text-sm font-semibold hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
      >
        <MapPin size={13} className="text-blue-500 shrink-0" />
        <span className="uppercase text-xs tracking-wider">{selectedName}</span>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-blue-100 rounded-xl shadow-2xl w-60 overflow-hidden"
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
                onClick={() => select('')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-blue-50',
                  selectedId === '' ? 'text-blue-600 font-semibold' : 'text-slate-700'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  selectedId === '' ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                )}>
                  {selectedId === '' && <Check size={9} strokeWidth={3} className="text-white" />}
                </div>
                All Stores
              </button>
            )}

            {/* Individual locations */}
            {filtered.map(l => (
              <button
                key={l.id}
                onClick={() => select(l.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-blue-50',
                  selectedId === l.id ? 'text-blue-600 font-semibold' : 'text-slate-700'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  selectedId === l.id ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                )}>
                  {selectedId === l.id && <Check size={9} strokeWidth={3} className="text-white" />}
                </div>
                {l.name}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">No stores found</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
