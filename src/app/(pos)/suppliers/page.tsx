'use client'

import { useState, useEffect } from 'react'
import { Supplier } from '@/types'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/lib/services/suppliers.service'
import Modal from '@/components/ui/Modal'
import { Plus, Edit2, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY: Omit<Supplier, 'id' | 'created_at'> = {
  name: '', contact_name: null, email: null, phone: null, address: null, notes: null, is_active: true,
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Supplier | null | 'new'>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load() {
    setSuppliers(await getSuppliers())
  }
  useEffect(() => { load() }, [])

  function openNew() { setForm(EMPTY); setEditing('new') }
  function openEdit(s: Supplier) { setForm({ name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone, address: s.address, notes: s.notes, is_active: s.is_active }); setEditing(s) }

  function set(field: string, value: unknown) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim() }
      if (editing === 'new') {
        await createSupplier(payload)
        toast.success('Supplier created')
      } else if (editing) {
        await updateSupplier(editing.id, payload)
        toast.success('Supplier updated')
      }
      setEditing(null)
      load()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return
    try { await deleteSupplier(s.id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-blue-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>

      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Contact</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No suppliers found</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-blue-200/50 hover:bg-blue-50/30">
                <td className="px-4 py-3 text-slate-900 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-slate-500">{s.contact_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.email ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-900/50 text-green-400' : 'bg-blue-100 text-slate-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(s)} className="text-slate-500 hover:text-blue-500"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(s)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add Supplier' : 'Edit Supplier'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Contact Name</label>
                <input type="text" value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Phone</label>
                <input type="text" value={form.phone ?? ''} onChange={e => set('phone', e.target.value || null)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || null)}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Address</label>
              <textarea value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} rows={2}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} rows={2}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sup_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="sup_active" className="text-sm text-slate-600">Active</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}