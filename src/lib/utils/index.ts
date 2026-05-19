import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

/**
 * Returns today's date as YYYY-MM-DD in the browser's LOCAL timezone.
 * Unlike new Date().toISOString().slice(0,10) which gives the UTC date,
 * this correctly returns e.g. "2026-05-20" when it's 11am in Fiji (UTC+12)
 * even though UTC is still "2026-05-19".
 */
export function localToday(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/**
 * Convert a local YYYY-MM-DD date to a UTC ISO string representing the
 * START of that day (00:00:00) in the user's local timezone.
 * Use this for Supabase .gte('created_at', ...) queries.
 */
export function localDayStart(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString()
}

/**
 * Convert a local YYYY-MM-DD date to a UTC ISO string representing the
 * END of that day (23:59:59) in the user's local timezone.
 * Use this for Supabase .lte('created_at', ...) queries.
 */
export function localDayEnd(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString()
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-FJ', {
    style: 'currency',
    currency: 'FJD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-FJ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-FJ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateReceiptNumber(): string {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  return `RCP-${timestamp}`
}

export function calculateLoyaltyPoints(totalAmount: number): number {
  // 1 point per $1 spent
  return Math.floor(totalAmount)
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') ? `"${str}"` : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
