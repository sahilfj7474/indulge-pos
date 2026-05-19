import { createClient } from '@/lib/supabase/client'

// ─── Payment Method Config ────────────────────────────────────────────────────

export interface PaymentMethodConfig {
  id: string                    // e.g. 'cash', 'card', 'mpaisa'
  label: string                 // display name
  surcharge_pct: number         // e.g. 4.5 means 4.5%
  enabled: boolean
  requires_customer?: boolean   // true for account/credit types
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'cash',           label: 'Cash',               surcharge_pct: 0, enabled: true },
  { id: 'card',           label: 'Card / EFTPOS',       surcharge_pct: 0, enabled: true },
  { id: 'bank_transfer',  label: 'Bank Transfer',       surcharge_pct: 0, enabled: true },
  { id: 'mpaisa',         label: 'MPaisa',              surcharge_pct: 0, enabled: true },
  { id: 'loyalty_points', label: 'Loyalty Points',      surcharge_pct: 0, enabled: true },
  { id: 'account',        label: 'Charge to Account',   surcharge_pct: 0, enabled: true, requires_customer: true },
]

export async function getPaymentMethods(): Promise<PaymentMethodConfig[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'payment_methods')
    .single()
  if (!data?.value) return DEFAULT_PAYMENT_METHODS
  try {
    return JSON.parse(data.value) as PaymentMethodConfig[]
  } catch {
    return DEFAULT_PAYMENT_METHODS
  }
}

export async function savePaymentMethods(methods: PaymentMethodConfig[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('settings').upsert(
    { key: 'payment_methods', value: JSON.stringify(methods), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

// ─── General Settings ─────────────────────────────────────────────────────────

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
