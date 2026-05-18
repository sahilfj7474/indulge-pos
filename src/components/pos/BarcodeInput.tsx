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
      <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Scan barcode or search products..."
        className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
      />
    </div>
  )
}
