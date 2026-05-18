'use client'

import { useState, useEffect } from 'react'
import { User, Location } from '@/types'
import { getAllUsers, updateUser, getLocations } from '@/lib/services/admin.service'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['cashier', 'supervisor', 'manager', 'admin'] as const
const ROLE_COLORS: Record<string, string> = {
  cashier:    'bg-blue-100 text-slate-600',
  supervisor: 'bg-blue-900/50 text-blue-400',
  manager:    'bg-purple-900/50 text-purple-400',
  admin:      'bg-indigo-900/50 text-blue-500',
}

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
          <thead><tr className="border-b border-blue-100">
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Role</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Location</th>
            <th className="text-center px-4 py-3 text-slate-500 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={cn('border-b border-blue-200/50 transition-colors', u.is_active ? 'hover:bg-blue-50/30' : 'opacity-50')}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_COLORS[u.role] ?? '')}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.location?.name ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs', u.is_active ? 'bg-green-900/50 text-green-400' : 'bg-blue-50 text-slate-400')}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(u)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-blue-100 rounded transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => toggleActive(u)} className={cn('p-1.5 rounded transition-colors', u.is_active ? 'text-slate-500 hover:text-red-400 hover:bg-blue-100' : 'text-slate-500 hover:text-green-400 hover:bg-blue-100')}>
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

function CreateUserModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'cashier', location_id: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) { toast.error('Fill in all required fields'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location_id: form.location_id || null }),
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
    <Modal title="Create User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {[['Full Name *', 'full_name', 'text', 'Jane Smith'], ['Email *', 'email', 'email', 'jane@example.com'], ['Password *', 'password', 'password', 'Min 6 characters']].map(([label, field, type, placeholder]) => (
          <div key={field}>
            <label className="block text-sm text-slate-500 mb-1">{label}</label>
            <input type={type} value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
              placeholder={placeholder} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Location</label>
            <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, locations, onClose, onSaved }: { user: User; locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, location_id: user.location_id ?? '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateUser(user.id, { full_name: form.full_name, role: form.role, location_id: form.location_id || null })
      toast.success('User updated'); onSaved(); onClose()
    } catch { toast.error('Failed to update') } finally { setSaving(false) }
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-slate-500 mb-1">Full Name</label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Location</label>
            <select value={form.location_id} onChange={e => set('location_id', e.target.value)} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  )
}