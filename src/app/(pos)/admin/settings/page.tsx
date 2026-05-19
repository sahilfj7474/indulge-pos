'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'

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
      { key: 'tax_rate',            label: 'VAT / Tax Rate (%)',              type: 'number',   placeholder: '9' },
      { key: 'tax_inclusive',       label: 'Prices are tax-inclusive',        type: 'checkbox', placeholder: '' },
      { key: 'vat_number',          label: 'VAT Registration Number',         type: 'text',     placeholder: 'FJ-VAT-...' },
      { key: 'currency',            label: 'Currency Code',                   type: 'text',     placeholder: 'FJD' },
      { key: 'card_surcharge_pct',  label: 'Card / EFTPOS Surcharge (%)',     type: 'number',   placeholder: '0' },
    ],
  },
  {
    title: 'Receipts',
    fields: [
      { key: 'receipt_header', label: 'Receipt Header Text',        type: 'text',     placeholder: 'Welcome to Indulge!' },
      { key: 'receipt_footer', label: 'Receipt Footer Message',     type: 'textarea', placeholder: 'Thank you for your purchase!' },
    ],
  },
  {
    title: 'Loyalty Program',
    fields: [
      { key: 'loyalty_rate', label: 'Loyalty Points per $1 spent', type: 'number', placeholder: '1' },
    ],
  },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('settings').select('key, value')
    const map: Record<string, string> = {}
    for (const s of (data ?? []) as Setting[]) map[s.key] = s.value
    setSettings(map)
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

  if (loading) return <div className="text-slate-400 text-sm">Loading settings...</div>

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">System-wide configuration</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
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

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium mb-1">To enable staff creation from the app:</p>
        <p className="text-amber-600">Add your Supabase Service Role key to <code className="bg-amber-100 px-1 rounded">.env.local</code>:</p>
        <code className="block mt-2 bg-white text-slate-600 px-3 py-2 rounded text-xs">
          SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
        </code>
      </div>
    </div>
  )
}