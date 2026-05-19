'use client'

import { useState, useEffect } from 'react'
import { CustomerGroup } from '@/types'
import {
  getCustomerGroups,
  saveCustomerGroup,
  deleteCustomerGroup,
  getGroupMemberCount,
} from '@/lib/services/customers.service'
import { Plus, Pencil, Trash2, X, Check, Users, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupForm {
  name: string
  discount_type: 'none' | 'flat_rate' | 'markup'
  discount_value: string
}

const BLANK_FORM: GroupForm = { name: '', discount_type: 'none', discount_value: '0' }

// ─── Helper ───────────────────────────────────────────────────────────────────

function discountLabel(g: CustomerGroup) {
  if (g.discount_type === 'none') return 'No discount'
  if (g.discount_type === 'flat_rate') return `${g.discount_value}% off`
  if (g.discount_type === 'markup')    return `${g.discount_value}% markup`
  return '—'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerGroupsPage() {
  const [groups, setGroups]       = useState<CustomerGroup[]>([])
  const [counts, setCounts]       = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)

  // Editing state (null = add new, group id = editing that group)
  const [editingId, setEditingId] = useState<string | null | 'new'>(null)
  const [form, setForm]           = useState<GroupForm>(BLANK_FORM)
  const [saving, setSaving]       = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<CustomerGroup | null>(null)
  const [deleting, setDeleting]           = useState(false)

  async function load() {
    setLoading(true)
    const data = await getCustomerGroups()
    setGroups(data)
    // Fetch member counts in parallel
    const entries = await Promise.all(
      data.map(async g => [g.id, await getGroupMemberCount(g.id)] as [string, number])
    )
    setCounts(Object.fromEntries(entries))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(g: CustomerGroup) {
    setEditingId(g.id)
    setForm({
      name:           g.name,
      discount_type:  g.discount_type,
      discount_value: String(g.discount_value),
    })
  }

  function startAdd() {
    setEditingId('new')
    setForm(BLANK_FORM)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(BLANK_FORM)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Group name is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...(editingId !== 'new' ? { id: editingId! } : {}),
        name:           form.name.trim(),
        discount_type:  form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
      }
      await saveCustomerGroup(payload)
      toast.success(editingId === 'new' ? 'Group created' : 'Group updated')
      cancelEdit()
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deleteCustomerGroup(confirmDelete.id)
      toast.success(`"${confirmDelete.name}" deleted`)
      setConfirmDelete(null)
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete group')
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage pricing tiers and discount groups for customers.
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Group
          </button>
        )}
      </div>

      {/* Add / Edit inline form */}
      {editingId !== null && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            {editingId === 'new' ? 'New Customer Group' : 'Edit Customer Group'}
          </p>

          <div className="grid grid-cols-3 gap-4">
            {/* Name */}
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Group Name *</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. VIP, Wholesale, Staff"
                className={inputCls}
              />
            </div>

            {/* Discount type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as GroupForm['discount_type'] }))}
                className={inputCls}
              >
                <option value="none">No discount</option>
                <option value="flat_rate">Flat Rate % Off</option>
                <option value="markup">Markup %</option>
              </select>
            </div>

            {/* Discount value */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {form.discount_type === 'flat_rate' ? 'Discount %' :
                 form.discount_type === 'markup'    ? 'Markup %'   : 'Value'}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                disabled={form.discount_type === 'none'}
                value={form.discount_value}
                onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                placeholder="0"
                className={cn(inputCls, form.discount_type === 'none' && 'opacity-40 cursor-not-allowed')}
              />
            </div>
          </div>

          {/* Form preview */}
          {form.discount_type !== 'none' && parseFloat(form.discount_value) > 0 && (
            <p className="text-xs text-slate-500 italic">
              Customers in <strong>{form.name || 'this group'}</strong> will receive a{' '}
              <strong>{form.discount_value}%</strong>{' '}
              {form.discount_type === 'flat_rate' ? 'discount on all purchases' : 'markup applied to their prices'}.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Check size={14} />
              {saving ? 'Saving...' : editingId === 'new' ? 'Create Group' : 'Update Group'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Groups table */}
      <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <Layers size={32} className="text-blue-200" />
            <p className="text-sm">No customer groups yet</p>
            <p className="text-xs">Create a group to assign pricing tiers to customers</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Group Name</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Discount / Pricing</th>
                <th className="text-center px-5 py-3 text-slate-500 font-medium">Members</th>
                <th className="text-center px-5 py-3 text-slate-500 font-medium">Default</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr
                  key={g.id}
                  className={cn(
                    'border-b border-blue-50 transition-colors',
                    editingId === g.id ? 'bg-blue-50/60' : 'hover:bg-blue-50/30'
                  )}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{g.name}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      g.discount_type === 'none'      ? 'bg-slate-100 text-slate-500' :
                      g.discount_type === 'flat_rate' ? 'bg-green-100 text-green-700' :
                                                        'bg-orange-100 text-orange-600'
                    )}>
                      {discountLabel(g)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-500 text-sm">
                      <Users size={12} className="text-slate-400" />
                      {counts[g.id] ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {g.is_default ? (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">
                        Default
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => startEdit(g)}
                        disabled={editingId !== null}
                        title="Edit"
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(g)}
                        disabled={editingId !== null || g.is_default}
                        title={g.is_default ? 'Cannot delete the default group' : 'Delete group'}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <p className="font-medium text-slate-700">How Customer Groups work</p>
        <ul className="text-xs text-slate-500 space-y-1 mt-1 list-disc list-inside">
          <li><strong>No discount</strong> — standard pricing, useful for named tiers like "Retail" or "Walk-in"</li>
          <li><strong>Flat Rate % Off</strong> — a percentage discount applied to all items at checkout for this customer</li>
          <li><strong>Markup %</strong> — a percentage added to the base price (e.g. for cost-plus wholesale accounts)</li>
          <li>Deleting a group removes it from all assigned customers but does not delete the customers.</li>
        </ul>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-blue-200 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete "{confirmDelete.name}"?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {(counts[confirmDelete.id] ?? 0) > 0
                    ? `This group has ${counts[confirmDelete.id]} customer(s). They will be moved to no group but will not be deleted.`
                    : 'This group has no members. It will be permanently removed.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
