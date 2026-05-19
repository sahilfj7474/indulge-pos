'use client'

import { useState, useEffect } from 'react'
import { Customer, CustomerGroup } from '@/types'
import { getCustomerGroups } from '@/lib/services/customers.service'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  customer?: Customer | null
  onClose: () => void
  onSaved: () => void
}

const BLANK = {
  first_name: '', last_name: '',
  email: '', phone: '', secondary_email: '',
  gender: '', date_of_birth: '',
  company: '', customer_tax_id: '',
  customer_group_id: '',
  customer_code: '', account_limit: '',
  address_line1: '', address_line2: '',
  city: '', state_province: '', country: 'Fiji', postal_code: '',
  notes: '',
  tax_exempt: false, marketing_opt_in: false,
}

export default function CustomerModal({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ ...BLANK })
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCustomerGroups().then(setGroups)
    if (customer) {
      setForm({
        first_name:        customer.first_name        ?? '',
        last_name:         customer.last_name         ?? '',
        email:             customer.email             ?? '',
        phone:             customer.phone             ?? '',
        secondary_email:   customer.secondary_email   ?? '',
        gender:            customer.gender            ?? '',
        date_of_birth:     customer.date_of_birth     ?? '',
        company:           customer.company           ?? '',
        customer_tax_id:   customer.customer_tax_id   ?? '',
        customer_group_id: customer.customer_group_id ?? '',
        customer_code:     customer.customer_code     ?? '',
        account_limit:     customer.account_limit ? String(customer.account_limit) : '',
        address_line1:     customer.address_line1     ?? '',
        address_line2:     customer.address_line2     ?? '',
        city:              customer.city              ?? '',
        state_province:    customer.state_province    ?? '',
        country:           customer.country           ?? 'Fiji',
        postal_code:       customer.postal_code       ?? '',
        notes:             customer.notes             ?? '',
        tax_exempt:        customer.tax_exempt        ?? false,
        marketing_opt_in:  customer.marketing_opt_in  ?? false,
      })
    }
  }, [customer])

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('At least a first or last name is required')
      return
    }
    setSaving(true)
    const supabase = createClient()
    try {
      const fullName = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ')
      const payload: Record<string, any> = {
        full_name:         fullName,
        first_name:        form.first_name.trim()  || null,
        last_name:         form.last_name.trim()   || null,
        email:             form.email.trim()        || null,
        phone:             form.phone.trim()        || null,
        secondary_email:   form.secondary_email.trim() || null,
        gender:            form.gender             || null,
        date_of_birth:     form.date_of_birth      || null,
        company:           form.company.trim()     || null,
        customer_tax_id:   form.customer_tax_id.trim() || null,
        customer_group_id: form.customer_group_id  || null,
        customer_code:     form.customer_code.trim() || null,
        account_limit:     parseFloat(form.account_limit) || 0,
        address_line1:     form.address_line1.trim() || null,
        address_line2:     form.address_line2.trim() || null,
        city:              form.city.trim()         || null,
        state_province:    form.state_province.trim() || null,
        country:           form.country.trim()      || null,
        postal_code:       form.postal_code.trim()  || null,
        notes:             form.notes.trim()        || null,
        tax_exempt:        form.tax_exempt,
        marketing_opt_in:  form.marketing_opt_in,
      }

      if (customer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', customer.id)
        if (error) throw error
        toast.success('Customer updated')
      } else {
        const { error } = await supabase.from('customers').insert(payload)
        if (error) throw error
        toast.success('Customer added')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const F = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
  const selectCls = inputCls

  return (
    <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex gap-0 divide-x divide-blue-100">
            {/* ── Left: main info ── */}
            <div className="flex-1 p-6 space-y-4 min-w-0">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Customer Information</p>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <F label="First Name" required>
                  <input autoFocus type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)}
                    placeholder="First name" className={inputCls} />
                </F>
                <F label="Last Name">
                  <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)}
                    placeholder="Last name" className={inputCls} />
                </F>
              </div>

              {/* Gender + DOB */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Gender">
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                </F>
                <F label="Date of Birth">
                  <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                    className={inputCls} />
                </F>
              </div>

              {/* Company + Tax ID */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Company Name">
                  <input type="text" value={form.company} onChange={e => set('company', e.target.value)}
                    placeholder="Company name" className={inputCls} />
                </F>
                <F label="Customer / Tax ID">
                  <input type="text" value={form.customer_tax_id} onChange={e => set('customer_tax_id', e.target.value)}
                    placeholder="Tax or ID number" className={inputCls} />
                </F>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Email">
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="email@example.com" className={inputCls} />
                </F>
                <F label="Phone">
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+679 xxx xxxx" className={inputCls} />
                </F>
              </div>

              {/* Secondary email */}
              <F label="Secondary Email">
                <input type="email" value={form.secondary_email} onChange={e => set('secondary_email', e.target.value)}
                  placeholder="secondary@example.com" className={inputCls} />
              </F>

              {/* Address */}
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider pt-1">Delivery Address</p>
              <F label="Address Line 1">
                <input type="text" value={form.address_line1} onChange={e => set('address_line1', e.target.value)}
                  placeholder="Street address" className={inputCls} />
              </F>
              <F label="Address Line 2">
                <input type="text" value={form.address_line2} onChange={e => set('address_line2', e.target.value)}
                  placeholder="Apt, suite, unit, etc." className={inputCls} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="City / Suburb">
                  <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                    placeholder="City" className={inputCls} />
                </F>
                <F label="State / Province">
                  <input type="text" value={form.state_province} onChange={e => set('state_province', e.target.value)}
                    placeholder="State" className={inputCls} />
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Country">
                  <input type="text" value={form.country} onChange={e => set('country', e.target.value)}
                    placeholder="Fiji" className={inputCls} />
                </F>
                <F label="Postal / ZIP Code">
                  <input type="text" value={form.postal_code} onChange={e => set('postal_code', e.target.value)}
                    placeholder="Postal code" className={inputCls} />
                </F>
              </div>
            </div>

            {/* ── Right: extra info ── */}
            <div className="w-64 shrink-0 p-6 space-y-4">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Account Details</p>

              <F label="Customer Code">
                <input type="text" value={form.customer_code} onChange={e => set('customer_code', e.target.value)}
                  placeholder="e.g. CUST-001" className={inputCls} />
              </F>

              <F label="Customer Group (Tier)">
                <select value={form.customer_group_id} onChange={e => set('customer_group_id', e.target.value)} className={selectCls}>
                  <option value="">No group</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}{g.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
              </F>

              <F label="Account Credit Limit ($)">
                <input type="number" min={0} step={0.01} value={form.account_limit}
                  onChange={e => set('account_limit', e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </F>

              <F label="Notes">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  rows={4} placeholder="Internal notes about this customer..."
                  className={`${inputCls} resize-none`} />
              </F>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.marketing_opt_in}
                    onChange={e => set('marketing_opt_in', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                  <span className="text-xs text-slate-500">
                    Customer has opted in to receive marketing &amp; promo communications
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.tax_exempt}
                    onChange={e => set('tax_exempt', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                  <span className="text-xs text-slate-500">
                    This customer is tax exempt. All taxes will be removed on their sales.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-blue-100 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="px-5 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? 'Saving...' : customer ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
