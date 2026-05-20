'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Location, UserRole } from '@/types'
import { getAllUsers, updateUser, deleteUser, getLocations } from '@/lib/services/admin.service'
import {
  PERMISSION_TREE, ROLE_PERMISSION_DEFAULTS, PermMap,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import {
  Plus, Pencil, UserCheck, UserX, MapPin, Globe,
  ChevronDown, ChevronRight, Shield, Trash2, MoreVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES: UserRole[] = ['cashier', 'supervisor', 'manager', 'admin']

const ROLE_COLORS: Record<string, string> = {
  cashier:    'bg-slate-100 text-slate-600',
  supervisor: 'bg-blue-100 text-blue-700',
  manager:    'bg-purple-100 text-purple-700',
  admin:      'bg-blue-600 text-white',
}

const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─── Location access label ─────────────────────────────────────
function LocationAccessLabel({ user, locations }: { user: User; locations: Location[] }) {
  if (!user.location_ids) {
    if (user.location_id && user.location) {
      return <span className="text-slate-600 text-xs">{user.location.name}</span>
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
        <Globe size={10} /> All Locations
      </span>
    )
  }
  if (user.location_ids.length === 0) return <span className="text-slate-400 text-xs">—</span>
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

// ─── Location picker ───────────────────────────────────────────
function LocationAccessPicker({ locations, allLocations, selectedIds, primaryId, onAllLocationsChange, onToggle, onPrimaryChange }: {
  locations: Location[]; allLocations: boolean; selectedIds: string[]; primaryId: string
  onAllLocationsChange: (v: boolean) => void; onToggle: (id: string) => void; onPrimaryChange: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm text-slate-500 font-medium">Location Access</label>
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <input type="checkbox" checked={allLocations} onChange={e => onAllLocationsChange(e.target.checked)}
          className="w-4 h-4 accent-blue-600 shrink-0" />
        <div>
          <span className="text-sm text-slate-700 font-medium group-hover:text-blue-600 transition-colors">All Locations</span>
          <p className="text-xs text-slate-400">Access data from every location</p>
        </div>
      </label>
      {!allLocations && (
        <div className="pl-4 space-y-1.5 border-l-2 border-blue-100 ml-1.5">
          {locations.map(loc => (
            <label key={loc.id} className="flex items-center gap-2.5 cursor-pointer group">
              <input type="checkbox" checked={selectedIds.includes(loc.id)} onChange={() => onToggle(loc.id)}
                className="w-4 h-4 accent-blue-600 shrink-0" />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">{loc.name}</span>
            </label>
          ))}
          {selectedIds.length === 0 && <p className="text-xs text-red-400 mt-1">Select at least one location</p>}
        </div>
      )}
      {!allLocations && selectedIds.length > 1 && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Primary Location <span className="text-slate-400">(POS terminal default)</span></label>
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

// ─── Action dropdown ───────────────────────────────────────────
function ActionMenu({ user, onEdit, onPermissions, onToggleActive, onDelete }: {
  user: User
  onEdit: () => void
  onPermissions: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setOpen(o => !o)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-white border border-blue-100 rounded-xl shadow-xl overflow-hidden w-44"
        >
          <button onClick={() => { onEdit(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 text-left transition-colors">
            <Pencil size={13} /> Edit
          </button>
          <button onClick={() => { onPermissions(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 text-left transition-colors">
            <Shield size={13} /> Permissions
          </button>
          <div className="border-t border-blue-100" />
          <button onClick={() => { onToggleActive(); setOpen(false) }}
            className={cn('flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors',
              user.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50')}>
            {user.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
            {user.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => { onDelete(); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </>
  )
}

// ─── Permissions modal ─────────────────────────────────────────
function PermissionsModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const defaults = ROLE_PERMISSION_DEFAULTS[user.role] ?? {}
  const [perms, setPerms] = useState<PermMap>({ ...defaults, ...(user.permissions_override ?? {}) })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ pos: true })
  const [saving, setSaving] = useState(false)

  function togglePerm(key: string) {
    setPerms(p => ({ ...p, [key]: !p[key] }))
  }

  function toggleGroup(groupKey: string, val: boolean) {
    const group = PERMISSION_TREE[groupKey]
    if (!group) return
    const update: PermMap = {}
    Object.keys(group.children).forEach(k => { update[`${groupKey}.${k}`] = val })
    setPerms(p => ({ ...p, ...update }))
  }

  function isGroupChecked(groupKey: string) {
    const group = PERMISSION_TREE[groupKey]
    if (!group) return false
    return Object.keys(group.children).every(k => perms[`${groupKey}.${k}`])
  }

  function isGroupIndeterminate(groupKey: string) {
    const group = PERMISSION_TREE[groupKey]
    if (!group) return false
    const vals = Object.keys(group.children).map(k => perms[`${groupKey}.${k}`])
    return vals.some(Boolean) && !vals.every(Boolean)
  }

  function resetToDefaults() {
    setPerms({ ...defaults })
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Only save keys that differ from role defaults
      const override: PermMap = {}
      let hasOverride = false
      Object.entries(perms).forEach(([k, v]) => {
        if (defaults[k] !== v) { override[k] = v; hasOverride = true }
      })
      await updateUser(user.id, { permissions_override: hasOverride ? override : null })
      toast.success('Permissions saved')
      onSaved(); onClose()
    } catch {
      toast.error('Failed to save permissions')
    } finally { setSaving(false) }
  }

  const hasChanges = Object.entries(perms).some(([k, v]) => defaults[k] !== v)

  return (
    <Modal title={`Permissions — ${user.full_name}`} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-1 mb-4 max-h-[60vh] overflow-y-auto pr-1">
        {Object.entries(PERMISSION_TREE).map(([groupKey, group]) => {
          const isExp = !!expanded[groupKey]
          const checked = isGroupChecked(groupKey)
          const indet  = isGroupIndeterminate(groupKey)
          return (
            <div key={groupKey} className="border border-blue-100 rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50/60 hover:bg-blue-100/50 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  ref={el => { if (el) el.indeterminate = indet }}
                  onChange={e => toggleGroup(groupKey, e.target.checked)}
                  className="w-4 h-4 accent-blue-600 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => setExpanded(ex => ({ ...ex, [groupKey]: !isExp }))}
                  className="flex items-center gap-1.5 flex-1 text-left"
                >
                  <span className="text-sm font-semibold text-slate-800">{group.label}</span>
                  <span className="ml-auto text-slate-400">
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
              </div>

              {/* Children */}
              {isExp && (
                <div className="divide-y divide-blue-50">
                  {Object.entries(group.children).map(([childKey, child]) => {
                    const key = `${groupKey}.${childKey}`
                    const val = !!perms[key]
                    const isDefault = defaults[key] === val
                    return (
                      <label key={key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={() => togglePerm(key)}
                          className="w-4 h-4 accent-blue-600 shrink-0"
                        />
                        <span className="text-sm text-slate-700 flex-1">{child.label}</span>
                        {!isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium shrink-0">
                            OVERRIDE
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-100">
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={!hasChanges}
          className="text-sm text-slate-500 hover:text-slate-700 underline disabled:opacity-30 transition-colors"
        >
          Reset to role defaults
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Create User Modal ─────────────────────────────────────────
function CreateUserModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'cashier' as UserRole,
    phone: '', max_discount_pct: '100',
  })
  const [allLocations, setAllLocations] = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])
  const [primaryId,    setPrimaryId]    = useState('')
  const [saving,       setSaving]       = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function toggleLocation(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!next.includes(primaryId)) setPrimaryId(next[0] ?? '')
      return next
    })
  }

  function handleRoleChange(role: UserRole) {
    set('role', role)
    if (role === 'admin' || role === 'manager') { setAllLocations(true); setSelectedIds([]) }
    else { setAllLocations(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) { toast.error('Fill in all required fields'); return }
    if (!allLocations && selectedIds.length === 0) { toast.error('Select at least one location'); return }
    setSaving(true)
    try {
      const location_id  = allLocations ? null : (primaryId || selectedIds[0] || null)
      const location_ids = allLocations ? null : selectedIds
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_discount_pct: parseFloat(form.max_discount_pct) || 100,
          location_id, location_ids,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('User created')
      onSaved(); onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Create User" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Full Name *</label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
              placeholder="Jane Smith" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+679 000 0000" className={inputCls} />
          </div>
        </div>

        {/* Email + Password */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="jane@example.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Password *</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Min 6 characters" className={inputCls} />
          </div>
        </div>

        {/* Role + Max Discount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Role</label>
            <select value={form.role} onChange={e => handleRoleChange(e.target.value as UserRole)} className={inputCls}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Discount % <span className="text-slate-400">(per invoice)</span></label>
            <input type="number" min={0} max={100} value={form.max_discount_pct}
              onChange={e => set('max_discount_pct', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="border-t border-blue-100" />

        <LocationAccessPicker
          locations={locations} allLocations={allLocations} selectedIds={selectedIds} primaryId={primaryId}
          onAllLocationsChange={v => { setAllLocations(v); if (v) setSelectedIds([]) }}
          onToggle={toggleLocation} onPrimaryChange={setPrimaryId}
        />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit User Modal ───────────────────────────────────────────
function EditUserModal({ user, locations, onClose, onSaved }: { user: User; locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const initAll = !user.location_ids && !user.location_id
  const initIds = user.location_ids ?? (user.location_id ? [user.location_id] : [])

  const [fullName,       setFullName]       = useState(user.full_name)
  const [phone,          setPhone]          = useState(user.phone ?? '')
  const [role,           setRole]           = useState<UserRole>(user.role)
  const [maxDiscount,    setMaxDiscount]    = useState(String(user.max_discount_pct ?? 100))
  const [allLocations,   setAllLocations]   = useState(initAll)
  const [selectedIds,    setSelectedIds]    = useState<string[]>(initIds)
  const [primaryId,      setPrimaryId]      = useState(user.location_id ?? initIds[0] ?? '')
  const [saving,         setSaving]         = useState(false)

  function toggleLocation(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!next.includes(primaryId)) setPrimaryId(next[0] ?? '')
      return next
    })
  }

  function handleRoleChange(r: UserRole) {
    setRole(r)
    if (r === 'admin' || r === 'manager') { setAllLocations(true); setSelectedIds([]) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allLocations && selectedIds.length === 0) { toast.error('Select at least one location'); return }
    setSaving(true)
    try {
      const location_id  = allLocations ? null : (primaryId || selectedIds[0] || null)
      const location_ids = allLocations ? null : selectedIds
      await updateUser(user.id, {
        full_name: fullName, phone: phone || null, role,
        max_discount_pct: parseFloat(maxDiscount) || 100,
        location_id, location_ids,
      })
      toast.success('User updated'); onSaved(); onClose()
    } catch { toast.error('Failed to update user') } finally { setSaving(false) }
  }

  return (
    <Modal title="Edit User" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+679 000 0000" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Role</label>
            <select value={role} onChange={e => handleRoleChange(e.target.value as UserRole)} className={inputCls}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Discount % <span className="text-slate-400">(per invoice)</span></label>
            <input type="number" min={0} max={100} value={maxDiscount}
              onChange={e => setMaxDiscount(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-xs text-slate-400">Email: {user.email}</p>

        <div className="border-t border-blue-100" />

        <LocationAccessPicker
          locations={locations} allLocations={allLocations} selectedIds={selectedIds} primaryId={primaryId}
          onAllLocationsChange={v => { setAllLocations(v); if (v) setSelectedIds([]) }}
          onToggle={toggleLocation} onPrimaryChange={setPrimaryId}
        />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Page ──────────────────────────────────────────────────────
export default function UsersPage() {
  const [users,     setUsers]     = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading,   setLoading]   = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const [showCreate,    setShowCreate]    = useState(false)
  const [editing,       setEditing]       = useState<User | null>(null)
  const [viewingPerms,  setViewingPerms]  = useState<User | null>(null)

  async function load() {
    const [u, l] = await Promise.all([getAllUsers(), getLocations()])
    setUsers(u); setLocations(l); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleToggleActive(user: User) {
    await updateUser(user.id, { is_active: !user.is_active })
    toast.success(user.is_active ? 'User deactivated' : 'User activated')
    load()
  }

  async function handleDelete(user: User) {
    if (!confirm(`Deactivate "${user.full_name}"? Their sales history will be preserved.`)) return
    await deleteUser(user.id)
    toast.success('User deactivated')
    load()
  }

  const filtered = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} staff accounts</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Role filter */}
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-100 bg-blue-50/50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Location Access</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Max Disc.</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className={cn('border-b border-blue-200/40 transition-colors',
                u.is_active ? 'hover:bg-blue-50/30' : 'opacity-50 bg-slate-50')}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{u.full_name}</div>
                  {u.phone && <div className="text-xs text-slate-400 mt-0.5">{u.phone}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_COLORS[u.role] ?? '')}>
                    {u.role}
                  </span>
                  {u.permissions_override && Object.keys(u.permissions_override).length > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                      <Shield size={9} /> custom
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LocationAccessLabel user={u} locations={locations} />
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {(u.max_discount_pct ?? 100) < 100 ? `${u.max_discount_pct}%` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                    u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionMenu
                    user={u}
                    onEdit={() => setEditing(u)}
                    onPermissions={() => setViewingPerms(u)}
                    onToggleActive={() => handleToggleActive(u)}
                    onDelete={() => handleDelete(u)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate   && <CreateUserModal locations={locations} onClose={() => setShowCreate(false)} onSaved={load} />}
      {editing      && <EditUserModal user={editing} locations={locations} onClose={() => setEditing(null)} onSaved={load} />}
      {viewingPerms && <PermissionsModal user={viewingPerms} onClose={() => setViewingPerms(null)} onSaved={load} />}
    </div>
  )
}
