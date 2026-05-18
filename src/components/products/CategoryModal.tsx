'use client'

import { useState } from 'react'
import { Category } from '@/types'
import { createCategory, updateCategory } from '@/lib/services/admin.service'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f97316',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#6b7280',
]

interface Props {
  category?: Category | null
  onClose: () => void
  onSaved: () => void
}

export default function CategoryModal({ category, onClose, onSaved }: Props) {
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? '#6366f1')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Category name is required'); return }
    setSaving(true)
    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), color })
        toast.success('Category updated')
      } else {
        await createCategory({ name: name.trim(), color })
        toast.success('Category created')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={category ? 'Edit Category' : 'Add Category'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="e.g. Beverages"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'white' : 'transparent',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : category ? 'Update' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
