'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn, localToday } from '@/lib/utils'

// All date calculations use LOCAL timezone (not UTC) so "Today" is correct
// even in UTC+12 where new Date().toISOString() would give yesterday's UTC date.
function localOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const TODAY         = localToday()
const YESTERDAY     = localOffset(-1)
const LAST7_START   = localOffset(-6)
const LAST30_START  = localOffset(-29)
const THIS_MONTH    = TODAY.slice(0, 7) + '-01'
const LAST_MONTH_S  = (() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
})()
const LAST_MONTH_E  = (() => {
  const d = new Date()
  d.setDate(0) // last day of previous month
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
})()

const PRESETS = [
  { label: 'Today',        from: TODAY,        to: TODAY },
  { label: 'Yesterday',    from: YESTERDAY,    to: YESTERDAY },
  { label: 'Last 7 days',  from: LAST7_START,  to: TODAY },
  { label: 'Last 30 days', from: LAST30_START, to: TODAY },
  { label: 'This month',   from: THIS_MONTH,   to: TODAY },
  { label: 'Last month',   from: LAST_MONTH_S, to: LAST_MONTH_E },
]

function getLabel(from: string, to: string): string {
  const preset = PRESETS.find(p => p.from === from && p.to === to)
  if (preset) return preset.label
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}`
}

interface Props {
  dateFrom: string
  dateTo:   string
  onChange: (from: string, to: string) => void
}

export default function DateRangePicker({ dateFrom, dateTo, onChange }: Props) {
  const [open,       setOpen]       = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo,   setCustomTo]   = useState(dateTo)
  const [pos,        setPos]        = useState({ top: 0, right: 0 })

  const buttonRef  = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
      setShowCustom(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function openDropdown() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({
        top:   rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setShowCustom(false)
    setOpen(o => !o)
  }

  function applyPreset(from: string, to: string) {
    onChange(from, to)
    setOpen(false)
    setShowCustom(false)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    const to = customTo < customFrom ? customFrom : customTo
    onChange(customFrom, to)
    setOpen(false)
    setShowCustom(false)
  }

  function openCustom() {
    setCustomFrom(dateFrom)
    setCustomTo(dateTo)
    setShowCustom(true)
  }

  const isCustom = !PRESETS.some(p => p.from === dateFrom && p.to === dateTo)

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openDropdown}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-600 text-sm font-medium hover:border-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
      >
        <Calendar size={13} className="text-slate-400 shrink-0" />
        {getLabel(dateFrom, dateTo)}
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className={cn(
            'bg-white border border-blue-100 rounded-xl shadow-2xl overflow-hidden',
            showCustom ? 'w-72' : 'w-52'
          )}
        >
          {/* Preset list */}
          {!showCustom && (
            <div className="py-1">
              {PRESETS.map(p => {
                const active = dateFrom === p.from && dateTo === p.to
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.from, p.to)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors',
                      active ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-blue-50'
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
              <button
                onClick={openCustom}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  isCustom ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-blue-50'
                )}
              >
                Custom range
              </button>
            </div>
          )}

          {/* Custom range panel */}
          {showCustom && (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Custom range</p>
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">To</label>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={e => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={applyCustom}
                  disabled={!customFrom || !customTo}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
