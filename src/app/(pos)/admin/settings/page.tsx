'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Setting { key: string; value: string }

const SETTING_DEFS = [
  { key: 'store_name',     label: 'Store Name',             type: 'text',   placeholder: 'Indulge' },
  { key: 'tax_rate',       label: 'Tax Rate (%)',           type: 'number', placeholder: '9' },
  { key: 'loyalty_rate',   label: 'Loyalty Points per $1',  type: 'number', placeholder: '1' },
  { key: 'currency',       label: 'Currency Code',          type: 'text',   placeholder: 'FJD' },
  { key: 'receipt_footer', label: 'Receipt Footer Message', type: 'textarea', placeholder: 'Thank you for your purchase!' },
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
      for (const def of SETTING_DEFS) {
        await supabase.from('settings').upsert(
          { key: def.key, value: settings[def.key] ?? '', updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      }
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

  if (loading) return <div className="text-gray-500 text-sm">Loading settings...</div>

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">System-wide configuration</p>
      </div>

      <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        {SETTING_DEFS.map(def => (
          <div key={def.key}>
            <label className="block text-sm font-medium text-gray-300 mb-1">{def.label}</label>
            {def.type === 'textarea' ? (
              <textarea
                value={settings[def.key] ?? ''}
                onChange={e => set(def.key, e.target.value)}
                rows={3}
                placeholder={def.placeholder}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              />
            ) : (
              <input
                type={def.type}
                value={settings[def.key] ?? ''}
                onChange={e => set(def.key, e.target.value)}
                placeholder={def.placeholder}
                step={def.type === 'number' ? '0.01' : undefined}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Service role key notice */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-300">
        <p className="font-medium mb-1">To enable staff creation from the app:</p>
        <p className="text-amber-400/80">Add your Supabase Service Role key to <code className="bg-amber-900/40 px-1 rounded">.env.local</code>:</p>
        <code className="block mt-2 bg-gray-900 text-gray-300 px-3 py-2 rounded text-xs">
          SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
        </code>
        <p className="mt-2 text-amber-400/80 text-xs">Find it in Supabase → Settings → API → <strong>service_role</strong> (secret key).</p>
      </div>
    </div>
  )
}
