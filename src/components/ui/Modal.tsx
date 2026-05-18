'use client'

import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}

export default function Modal({ title, onClose, children, maxWidth = 'max-w-md' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-900 border border-gray-700 rounded-xl w-full ${maxWidth} shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
