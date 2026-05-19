'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getPaymentMethods,
  savePaymentMethods,
  DEFAULT_PAYMENT_METHODS,
  PaymentMethodConfig,
} from '@/lib/services/settings.service'
import { Save, Plus, Pencil, Trash2, Check, X, Banknote, CreditCard, Building2, Star, BookUser, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Setting { key: string; value: string }

const SETTING_GROUPS = [
  {
    title: 'Business Information',
    fields: [
      { key: 'store_name',       label: 'Store / Business Name',   type: 'text',   placeholder: 'Indulge' },
      { key: 'business_address', label: 'Business Address',        type: 'text',   placeholder: '123 Main St, Suva' },
      { key: 'business_phone',   label: 'Business Phone',          type: 'text',   placeholder: '+679 123 4567' },
      { key: 'business_email',   label: 'Business Email',          type: 'text',   placeholder: 'info@indulge.com.fj' },
    ],
  },
  {
    title: 'Tax & Pricing',
    fields: [
      { key: 'tax_rate',      label: 'VAT / Tax Rate (%)',       type: 'number',   placeholder: '9' },
      { key: 'tax_inclusive', label: 'Prices are tax-inclusive', type: 'checkbox', placeholder: '' },
      { key: 'vat_number',   label: 'VAT Registration Number',   type: 'text',     placeholder: 'FJ-VAT-...' },
      { key: 'currency',     label: 'Currency Code',             type: 'text',     placeholder: 'FJD' },
    ],
  },
  {
    title: 'Receipts',
    fields: [
      { key: 'receipt_header', label: 'Receipt Header Text',    type: 'text',     placeholder: 'Welcome to Indulge!' },
      { key: 'receipt_footer', label: 'Receipt Footer Message', type: 'textarea', placeholder: 'Thank you for your purchase!' },
    ],
  },
  {
    title: 'Loyalty Program',
    fields: [
      { key: 'loyalty_rate', label: 'Loyalty Points per $1 spent', type: 'number', placeholder: '1' },
    ],
  },
]

function methodIcon(id: string) {
  if (id === 'cash')                                          return Banknote
  if (id === 'card' || id === 'eftpos')                       return CreditCard
  if (id === 'bank_transfer' || id === 'bank')                return Building2
  if (id === 'loyalty_points' || id === 'loyalty')            return Star
  if (id === 'account')                                       return BookUser
  if (['mpaisa','mobile','phone','mpay'].some(k => id.includes(k))) return Smartphone
  return CreditCard
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

const BLANK_NEW: Omit<PaymentMethodConfig, 'id'> = {
  label: '', surcharge_pct: 0, enabled: true, requires_customer: false,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PaymentMethodConfig | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newMethod, setNewMethod] = useState(BLANK_NEW)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('settings').select('key, value')
    const map: Record<string, string> = {}
    for (const s of (data ?? []) as Setting[]) map[s.key] = s.value
    setSettings(map)
    const methods = await getPaymentMethods()
    setPaymentMethods(methods)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    try {
      const allKeys = SETTING_GROUPS.flatMap(g => g.fields.map(f => f.key))
      await Promise.all(allKeys.map(key =>
        supabase.from('settings').upsert(
          { key, value: settings[key] ?? '', updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      ))
      await savePaymentMethods(paymentMethods)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function set(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // ── Payment method CRUD ──────────────────────────────────────────────────────

  function startEdit(m: PaymentMethodConfig) {
    setEditingId(m.id)
    setEditForm({ ...m })
    setShowAdd(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  function commitEdit() {
    if (!editForm) return
    setPaymentMethods(prev => prev.map(m => m.id === editForm.id ? editForm : m))
    setEditingId(null)
    setEditForm(null)
  }

  function toggleEnabled(id: string) {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  function deleteMethod(id: string) {
    setPaymentMethods(prev => prev.filter(m => m.id !== id))
  }

  function commitAdd() {
    if (!newMethod.label.trim()) return
    const id = slugify(newMethod.label) || `method_${Date.now()}`
    const unique = paymentMethods.some(m => m.id === id) ? `${id}_${Date.now()}` : id
    setPaymentMethods(prev => [...prev, { id: unique, ...newMethod }])
    setNewMethod(BLANK_NEW)
    setShowAdd(false)
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading settings...</div>

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">System-wide configuration</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* ── Standard setting groups ── */}
        {SETTING_GROUPS.map(group => (
          <div key={group.title} className="bg-white border border-blue-100 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-600 border-b border-blue-100 pb-2">{group.title}</h2>
            {group.fields.map(def => (
              <div key={def.key}>
                <label className="block text-sm font-medium text-slate-600 mb-1">{def.label}</label>
                {def.type === 'checkbox' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={def.key}
                      checked={settings[def.key] === 'true'}
                      onChange={e => set(def.key, e.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <label htmlFor={def.key} className="text-sm text-slate-500">
                      {settings[def.key] === 'true' ? 'Yes — tax is included in product prices' : 'No — tax is added on top of price'}
                    </label>
                  </div>
                ) : def.type === 'textarea' ? (
                  <textarea
                    value={settings[def.key] ?? ''}
                    onChange={e => set(def.key, e.target.value)}
                    rows={3}
                    placeholder={def.placeholder}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                ) : (
                  <input
                    type={def.type}
                    value={settings[def.key] ?? ''}
                    onChange={e => set(def.key, e.target.value)}
                    placeholder={def.placeholder}
                    step={def.type === 'number' ? '0.01' : undefined}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        ))}

        {/* ── Payment Methods ── */}
        <div className="bg-white border border-blue-100 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 border-b border-blue-100 pb-2">Payment Methods</h2>

          <div className="space-y-2">
            {paymentMethods.map(m => {
              const Icon = methodIcon(m.id)
              const isEditing = editingId === m.id

              if (isEditing && editForm) {
                return (
                  <div key={m.id} className="bg-blue-50 border border-blue-300 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={editForm.label}
                        onChange={e => setEditForm(f => f ? { ...f, label: e.target.value } : f)}
                        placeholder="Method name"
                        className="flex-1 px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={editForm.surcharge_pct || ''}
                          onChange={e => setEditForm(f => f ? { ...f, surcharge_pct: parseFloat(e.target.value) || 0 } : f)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editForm.requires_customer}
                          onChange={e => setEditForm(f => f ? { ...f, requires_customer: e.target.checked } : f)}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        Requires customer
                      </label>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                          Cancel
                        </button>
                        <button type="button" onClick={commitEdit} className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1">
                          <Check size={11} /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 rounded-lg">
                  <Icon size={15} className="text-slate-400 shrink-0" />
                  <span className={cn('flex-1 text-sm font-medium', m.enabled ? 'text-slate-800' : 'text-slate-400 line-through')}>
                    {m.label}
                  </span>
                  {m.surcharge_pct > 0 && (
                    <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      +{m.surcharge_pct}%
                    </span>
                  )}
                  {m.requires_customer && (
                    <span className="text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">acct</span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(m.id)}
                    className={cn(
                      'text-xs px-2 py-1 rounded font-medium transition-colors',
                      m.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    )}
                  >
                    {m.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMethod(m.id)}
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add new method form */}
          {showAdd ? (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newMethod.label}
                  onChange={e => setNewMethod(n => ({ ...n, label: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAdd() } if (e.key === 'Escape') { setShowAdd(false); setNewMethod(BLANK_NEW) } }}
                  placeholder="Method name (e.g. MPaisa)"
                  className="flex-1 px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={newMethod.surcharge_pct || ''}
                    onChange={e => setNewMethod(n => ({ ...n, surcharge_pct: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-16 px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!newMethod.requires_customer}
                    onChange={e => setNewMethod(n => ({ ...n, requires_customer: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Requires customer
                </label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { setShowAdd(false); setNewMethod(BLANK_NEW) }}
                    className="px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="button" onClick={commitAdd} disabled={!newMethod.label.trim()}
                    className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                    <Check size={11} /> Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setEditingId(null); setEditForm(null) }}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium py-1"
            >
              <Plus size={14} /> Add payment method
            </button>
          )}

          <p className="text-xs text-slate-400">
            Changes take effect after clicking <strong>Save Settings</strong> below.
          </p>
        </div>

        {/* Save button */}
        <div className="bg-white border border-blue-100 rounded-xl p-5">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
