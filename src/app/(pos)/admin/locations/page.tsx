'use client'

import { useState, useEffect } from 'react'
import { Location } from '@/types'
import { getLocations, createLocation, updateLocation } from '@/lib/services/admin.service'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)

  async function load() {
    const data = await getLocations()
    setLocations(data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggleActive(loc: Location) {
    await updateLocation(loc.id, { is_active: !loc.is_active })
    toast.success(loc.is_active ? 'Location deactivated' : 'Location activated')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Locations</h1>
          <p className="text-sm text-gray-400 mt-0.5">{locations.length} locations</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> Add Location
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? <p className="text-gray-500 text-sm">Loading...</p> : locations.map(loc => (
          <div key={loc.id} className={cn('bg-gray-900 border rounded-xl p-4', loc.is_active ? 'border-gray-800' : 'border-gray-800 opacity-60')}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg mt-0.5', loc.is_active ? 'bg-indigo-900/40' : 'bg-gray-800')}>
                  <MapPin size={16} className={loc.is_active ? 'text-indigo-400' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="font-semibold text-white">{loc.name}</p>
                  {loc.address && <p className="text-sm text-gray-400 mt-0.5">{loc.address}</p>}
                  {loc.phone   && <p className="text-sm text-gray-400">{loc.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(loc); setShowModal(true) }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActive(loc)}
                  className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                    loc.is_active ? 'bg-green-900/50 text-green-400 hover:bg-red-900/50 hover:text-red-400' : 'bg-gray-800 text-gray-500 hover:bg-green-900/50 hover:text-green-400')}>
                  {loc.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <LocationModal location={editing} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  )
}

function LocationModal({ location, onClose, onSaved }: { location: Location | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: location?.name ?? '', address: location?.address ?? '', phone: location?.phone ?? '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Location name is required'); return }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() || null, phone: form.phone.trim() || null }
      if (location) { await updateLocation(location.id, payload); toast.success('Location updated') }
      else { await createLocation(payload); toast.success('Location created') }
      onSaved(); onClose()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  return (
    <Modal title={location ? 'Edit Location' : 'Add Location'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {[['Name *', 'name', 'Indulge - City Branch'], ['Address', 'address', '123 Main Street, Suva'], ['Phone', 'phone', '+679 xxx xxxx']].map(([label, field, placeholder]) => (
          <div key={field}>
            <label className="block text-sm text-gray-400 mb-1">{label}</label>
            <input type="text" value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
              placeholder={placeholder} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {saving ? 'Saving...' : location ? 'Update' : 'Add Location'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
