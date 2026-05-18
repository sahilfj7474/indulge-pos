import { createClient } from '@/lib/supabase/client'

export async function getSettings(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase.from('settings').select('key, value')
  const map: Record<string, string> = {}
  for (const s of (data ?? []) as { key: string; value: string }[]) map[s.key] = s.value
  return map
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

export async function saveSettings(updates: Record<string, string>): Promise<void> {
  const supabase = createClient()
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    )
  )
}
