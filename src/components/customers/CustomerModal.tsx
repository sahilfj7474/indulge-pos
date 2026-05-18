'use client'

import { useState } from 'react'
import { Customer } from '@/types'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface Props {
  customer?: Customer | null
  onClose: () => void
  onSaved: () => void
}

export default function CustomerModal({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    full_name: customer?.full_name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const supabase = createClient()
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      }
      if (customer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', customer.id)
        if (error) throw error
        toast.success('Customer updated')
      } else {
        const { error } = await supabase.from('customers').insert(payload)
        if (error) throw error
        toast.success('Customer added')
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
    <Modal title={customer ? 'Edit Customer' : 'Add Customer'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-500 mb-1">Full Name *</label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="+679 xxx xxxx"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="jane@example.com"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving...' : customer ? 'Update' : 'Add Customer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}