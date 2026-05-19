'use client'

import { useState, useEffect } from 'react'
import { Location, OpeningHours } from '@/types'
import { getLocations, createLocation, updateLocation } from '@/lib/services/admin.service'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, MapPin, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Constants ────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon first … Sun last

// 30-min increments 6 AM – 11:30 PM
const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 23) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function fmt(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`
}

function defaultHours(): OpeningHours[] {
  return DAY_ORDER.map(day => ({ day, open: day !== 0, from: '09:00', to: '21:00' }))
}

function groupHours(hours: OpeningHours[]) {
  const sorted = DAY_ORDER.map(d => hours.find(h => h.day === d)).filter(Boolean) as OpeningHours[]
  const groups: { days: number[]; open: boolean; from: string; to: string }[] = []
  for (const h of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.open === h.open && last.from === h.from && last.to === h.to) {
      last.days.push(h.day)
    } else {
      groups.push({ days: [h.day], open: h.open, from: h.from, to: h.to })
    }
  }
  return groups
}

// ── Page ─────────────────────────────────────────────────────
export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Location | null>(null)

  async function load() {
    const data = await getLocations()
    setLocations(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggleActive(loc: Location) {
    await updateLocation(loc.id, { is_active: !loc.is_active })
    toast.success(loc.is_active ? 'Location deactivated' : 'Location activated')
    load()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Locations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{locations.length} locations</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Location
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : locations.length === 0 ? (
          <div className="bg-white border border-blue-100 rounded-xl p-12 text-center text-slate-400 text-sm">
            No locations yet. Add one to get started.
          </div>
        ) : locations.map(loc => {
          const hours  = loc.opening_hours ?? []
          const groups = hours.length > 0 ? groupHours(hours) : []

          return (
            <div
              key={loc.id}
              className={cn(
                'bg-white border rounded-xl p-4',
                loc.is_active ? 'border-blue-100' : 'border-blue-100 opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left — name + address + contact */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={cn(
                    'p-2 rounded-lg mt-0.5 shrink-0',
                    loc.is_active ? 'bg-blue-100' : 'bg-blue-50'
                  )}>
                    <MapPin size={16} className={loc.is_active ? 'text-blue-500' : 'text-slate-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{loc.name}</p>
                    {loc.address && (
                      <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-line">{loc.address}</p>
                    )}
                    {(loc.email || loc.phone) && (
                      <p className="text-xs text-slate-400 mt-1">
                        {[loc.email, loc.phone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right — actions + hours chips */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditing(loc); setShowModal(true) }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => toggleActive(loc)}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                        loc.is_active
                          ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-500'
                          : 'bg-blue-50 text-slate-400 hover:bg-green-100 hover:text-green-600'
                      )}
                    >
                      {loc.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Opening hours chips */}
                  {groups.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-sm">
                      {groups.map((g, i) => {
                        const label = g.days.map(d => DAY_NAMES[d].toUpperCase()).join(', ')
                        return (
                          <span
                            key={i}
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
                              g.open
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            )}
                          >
                            {g.open
                              ? `${label} : ${fmt(g.from)} – ${fmt(g.to)}`
                              : `${label} : CLOSED`}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      <span>No hours set</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <LocationModal
          location={editing}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
function LocationModal({
  location, onClose, onSaved,
}: {
  location: Location | null
  onClose:  () => void
  onSaved:  () => void
}) {
  const [name,    setName]    = useState(location?.name    ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [email,   setEmail]   = useState(location?.email   ?? '')
  const [phone,   setPhone]   = useState(location?.phone   ?? '')
  const [hours,   setHours]   = useState<OpeningHours[]>(location?.opening_hours ?? defaultHours())
  const [saving,  setSaving]  = useState(false)

  function updateDay(day: number, key: keyof OpeningHours, value: boolean | string) {
    setHours(prev => prev.map(h => h.day === day ? { ...h, [key]: value } : h))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Location name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name:          name.trim(),
        address:       address.trim() || null,
        email:         email.trim()   || null,
        phone:         phone.trim()   || null,
        opening_hours: hours,
      }
      if (location) {
        await updateLocation(location.id, payload)
        toast.success('Location updated')
      } else {
        await createLocation(payload)
        toast.success('Location created')
      }
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const sectionLabel = 'text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3'

  return (
    <Modal
      title={location ? 'Edit Location' : 'Add Location'}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Info + Address ── */}
          <div className="space-y-5">
            {/* Info */}
            <div>
              <p className={sectionLabel}>Location Info</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Location Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Indulge - City Branch"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="store@indulge.fj"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+679 xxx xxxx"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <p className={sectionLabel}>Address</p>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Main Street, Suva, Fiji"
                rows={3}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* ── Right: Opening Hours ── */}
          <div>
            <p className={sectionLabel}>Opening Hours</p>
            <div className="bg-blue-50/40 border border-blue-100 rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[72px_44px_1fr] px-3 py-2 border-b border-blue-100 text-xs font-medium text-slate-500">
                <span>Day</span>
                <span className="text-center">Open?</span>
                <span className="pl-2">Hours</span>
              </div>

              {DAY_ORDER.map(day => {
                const h = hours.find(x => x.day === day) ?? { day, open: true, from: '09:00', to: '21:00' }
                return (
                  <div
                    key={day}
                    className={cn(
                      'grid grid-cols-[72px_44px_1fr] items-center px-3 py-2 border-b border-blue-100/60 last:border-b-0 transition-opacity',
                      !h.open && 'opacity-50'
                    )}
                  >
                    <span className="text-sm text-slate-700 font-medium">{DAY_NAMES[day]}</span>

                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={h.open}
                        onChange={e => updateDay(day, 'open', e.target.checked)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {h.open ? (
                      <div className="flex items-center gap-1.5 pl-2">
                        <select
                          value={h.from}
                          onChange={e => updateDay(day, 'from', e.target.value)}
                          className="flex-1 px-1.5 py-1 bg-white border border-blue-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt(t)}</option>)}
                        </select>
                        <span className="text-slate-400 text-xs shrink-0">–</span>
                        <select
                          value={h.to}
                          onChange={e => updateDay(day, 'to', e.target.value)}
                          className="flex-1 px-1.5 py-1 bg-white border border-blue-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt(t)}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="pl-2 text-xs font-semibold text-amber-500">CLOSED</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 pt-2 border-t border-blue-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : location ? 'Update Location' : 'Add Location'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
