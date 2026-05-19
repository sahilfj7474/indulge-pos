'use client'

import { useEffect, useRef } from 'react'
import { ScanLine } from 'lucide-react'

interface Props {
  onScan: (barcode: string) => void
  value: string
  onChange: (v: string) => void
}

const INTERACTIVE = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']

export default function BarcodeInput({ onScan, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) {
      onScan(value.trim())
      onChange('')
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Only reclaim focus if the user clicked on non-interactive empty space
    const next = e.relatedTarget as HTMLElement | null
    if (!next || (!INTERACTIVE.includes(next.tagName) && !next.closest('[role="button"]'))) {
      setTimeout(() => ref.current?.focus(), 50)
    }
  }

  return (
    <div className="relative">
      <ScanLine size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Scan barcode or search products..."
        className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}