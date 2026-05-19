'use client'

import { useState, useEffect } from 'react'
import { User, Location } from '@/types'
import { getAllUsers, updateUser, getLocations } from '@/lib/services/admin.service'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, UserCheck, UserX, MapPin, Globe } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['cashier', 'supervisor', 'manager', 'admin'] as const

const ROLE_COLORS: Record<string, string> = {
  cashier:    'bg-slate-100 text-slate-600',
  supervisor: 'bg-blue-100 text-blue-700',
  manager:    'bg-purple-100 text-purple-700',
  admin:      'bg-blue-600 text-white',
}

// ─── Location access label for table ─────────────────────────
function LocationAccessLabel({ user, locations }: { user: User; locations: Location[] }) {
  if (!user.location_ids) {
    // null = All Locations (admin/manager) OR single location (cashier/supervisor)
    if (user.location_id && user.location) {
      return <span className="text-slate-600 text-xs">{user.location.name}</span>
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
        <Globe size={10} /> All Locations
      </span>
    )
  }
  if (user.location_ids.length === 0) {
    return <span className="text-slate-400 text-xs">—</span>
  }
  if (user.location_ids.length === 1) {
    const loc = locations.find(l => l.id === user.location_ids![0])
    return <span className="text-slate-600 text-xs">{loc?.name ?? '1 location'}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">
      <MapPin size={10} /> {user.location_ids.length} locations
    </span>
  )
}

// ─── Shared location picker component ────────────────────────
interface LocationPickerProps {
  locations: Location[]
  allLocations: boolean
  selectedIds: string[]
  primaryId: string
  onAllLocationsChange: (v: boolean) => void
  onToggleLocation: (id: string) => void
  onPrimaryChange: (id: string) => void
}

function LocationAccessPicker({
  locations, allLocations, selectedIds, primaryId,
  onAllLocationsChange, onToggleLocation, onPrimaryChange,
}: LocationPickerProps) {
  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-3">
      <label className="block text-sm text-slate-500 font-medium">Location Access</label>

      {/* All Locations toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={allLocations}
          onChange={e => onAllLocationsChange(e.target.checked)}
          className="w-4 h-4 accent-blue-600 shrink-0"
        />
        <div>
          <span className="text-sm text-slate-700 font-medium group-hover:text-blue-600 transition-colors">
            All Locations
          </span>
          <p className="text-xs text-slate-400">User can access data from every location</p>
        </div>
      </label>

      {/* Specific location checkboxes */}
      {!allLocations && (
        <div className="pl-1 space-y-1.5 border-l-2 border-blue-100 ml-1.5 pl-4">
          {locations.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No locations found</p>
          ) : locations.map(loc => (
            <label key={loc.id} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedIds.includes(loc.id)}
                onChange={() => onToggleLocation(loc.id)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                {loc.name}
              </span>
            </label>
          ))}
          {selectedIds.length === 0 && (
            <p className="text-xs text-red-400 mt-1">Select at least one location</p>
          )}
        </div>
      )}

      {/* Primary location (used for POS terminal) */}
      {!allLocations && selectedIds.length > 1 && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Primary Location <span className="text-slate-400">(used for POS terminal)</span></label>
          <select value={primaryId} onChange={e => onPrimaryChange(e.target.value)} className={inputCls}>
            {selectedIds.map(id => {
              const loc = locations.find(l => l.id === id)
              return <option key={id} value={id}>{loc?.name ?? id}</option>
            })}
          </select>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  async function load() {
    const [u, l] = await Promise.all([getAllUsers(), getLocations()])
    setUsers(u); setLocations(l); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggleActive(user: User) {
    await updateUser(user.id, { is_active: !user.is_active })
    toast.success(user.is_active ? 'User deactivated' : 'User activated')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} staff accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={15} /> Add User
        </button>
      </div>

      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100 bg-blue-50/50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Location Access</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={cn('border-b border-blue-200/40 transition-colors', u.is_active ? 'hover:bg-blue-50/30' : 'opacity-50')}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_COLORS[u.role] ?? '')}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <LocationAccessLabel user={u} locations={locations} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs', u.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400')}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(u)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-blue-100 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleActive(u)} className={cn('p-1.5 rounded transition-colors', u.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50')}>
                      {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal locations={locations} onClose={() => setShowCreate(false)} onSaved={load} />}
      {editing   && <EditUserModal   user={editing} locations={locations} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}

// ─── Create User Modal ────────────────────────────────────────
function CreateUserModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'cashier',
  })
  const [allLocations, setAllLocations] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [primaryId, setPrimaryId] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function toggleLocation(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // Auto-set primary to first selected if not already valid
      if (!next.includes(primaryId)) setPrimaryId(next[0] ?? '')
      return next
    })
  }

  // When role changes to admin/manager, default to all locations
  function handleRoleChange(role: string) {
    set('role', role)
    if (role === 'admin' || role === 'manager') {
      setAllLocations(true)
      setSelectedIds([])
    } else {
      setAllLocations(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Fill in all required fields'); return
    }
    if (!allLocations && selectedIds.length === 0) {
      toast.error('Select at least one location or choose "All Locations"'); return
    }
    setSaving(true)
    try {
      const location_id  = allLocations ? null : (primaryId || selectedIds[0] || null)
      const location_ids = allLocations ? null : selectedIds

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location_id, location_ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('User created')
      onSaved(); onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <Modal title="Create User" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name, Email, Password */}
        {([
          ['Full Name *', 'full_name', 'text', 'Jane Smith'],
          ['Email *', 'email', 'email', 'jane@example.com'],
          ['Password *', 'password', 'password', 'Min 6 characters'],
        ] as [string, string, string, string][]).map(([label, field, type, placeholder]) => (
          <div key={field}>
            <label className="block text-sm text-slate-500 mb-1">{label}</label>
            <input type={type} value={(form as Record<string, string>)[field]}
              onChange={e => set(field, e.target.value)}
              placeholder={placeholder} className={inputCls} />
          </div>
        ))}

        {/* Role */}
        <div>
          <label className="block text-sm text-slate-500 mb-1">Role</label>
          <select value={form.role} onChange={e => handleRoleChange(e.target.value)} className={inputCls}>
            {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>

        {/* Divider */}
        <div className="border-t border-blue-100" />

        {/* Location access */}
        <LocationAccessPicker
          locations={locations}
          allLocations={allLocations}
          selectedIds={selectedIds}
          primaryId={primaryId}
          onAllLocationsChange={v => { setAllLocations(v); if (v) setSelectedIds([]) }}
          onToggleLocation={toggleLocation}
          onPrimaryChange={setPrimaryId}
        />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────
function EditUserModal({ user, locations, onClose, onSaved }: { user: User; locations: Location[]; onClose: () => void; onSaved: () => void }) {
  // Derive initial state from user data
  const initAllLocations = user.location_ids === null && !user.location_id
    ? true   // explicitly no location_id and no location_ids → was "all" (admin default)
    : user.location_ids === null
      ? user.location_id === null   // null location_id + null location_ids = all
      : false  // has specific location_ids array

  const initSelectedIds = user.location_ids ?? (user.location_id ? [user.location_id] : [])

  const [fullName, setFullName] = useState(user.full_name)
  const [role, setRole]         = useState(user.role)
  const [allLocations, setAllLocations] = useState(initAllLocations)
  const [selectedIds, setSelectedIds]   = useState<string[]>(initSelectedIds)
  const [primaryId, setPrimaryId]       = useState(user.location_id ?? initSelectedIds[0] ?? '')
  const [saving, setSaving]             = useState(false)

  function toggleLocation(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!next.includes(primaryId)) setPrimaryId(next[0] ?? '')
      return next
    })
  }

  function handleRoleChange(newRole: string) {
    setRole(newRole as typeof role)
    if (newRole === 'admin' || newRole === 'manager') {
      setAllLocations(true)
      setSelectedIds([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allLocations && selectedIds.length === 0) {
      toast.error('Select at least one location or choose "All Locations"'); return
    }
    setSaving(true)
    try {
      const location_id  = allLocations ? null : (primaryId || selectedIds[0] || null)
      const location_ids = allLocations ? null : selectedIds
      await updateUser(user.id, { full_name: fullName, role, location_id, location_ids })
      toast.success('User updated'); onSaved(); onClose()
    } catch {
      toast.error('Failed to update user')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <Modal title="Edit User" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-500 mb-1">Full Name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Role</label>
          <select value={role} onChange={e => handleRoleChange(e.target.value)} className={inputCls}>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-blue-100" />

        <LocationAccessPicker
          locations={locations}
          allLocations={allLocations}
          selectedIds={selectedIds}
          primaryId={primaryId}
          onAllLocationsChange={v => { setAllLocations(v); if (v) setSelectedIds([]) }}
          onToggleLocation={toggleLocation}
          onPrimaryChange={setPrimaryId}
        />

        {/* Current email — read only */}
        <p className="text-xs text-slate-400">Email: {user.email}</p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Update User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
