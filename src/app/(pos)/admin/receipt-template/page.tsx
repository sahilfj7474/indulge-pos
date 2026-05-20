'use client'

import { useState, useEffect } from 'react'
import {
  ReceiptTemplate, ReceiptTemplateInput,
  DEFAULT_TEMPLATE,
  getDefaultReceiptTemplate,
  saveReceiptTemplate,
} from '@/lib/services/receipt-template.service'
import { Save, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────
const W = 36
const DIV  = '─'.repeat(W)
const HDIV = '═'.repeat(W)

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  const gap = Math.max(1, W - l.length - r.length)
  return (
    <div className={cn('flex justify-between', bold && 'font-bold')}>
      <span>{l}</span><span>{r}</span>
    </div>
  )
}

// ── Thermal receipt preview ───────────────────────────────────
function ThermalPreview({ t }: { t: ReceiptTemplateInput }) {
  const SAMPLE_STORE   = t.trading_name  || 'INDULGE'
  const SAMPLE_ADDR    = '123 Main Street, Suva, Fiji'
  const SAMPLE_EMAIL   = 'info@indulge.fj'
  const SAMPLE_PHONE   = '+679 777 0000'
  const SAMPLE_CASHIER = 'Mika Taufa'
  const SAMPLE_DATE    = '20 May 2026, 11:30 AM'
  const subtotal = 64.40
  const tax      = 5.80
  const total    = 70.20
  const cash     = 80.00
  const change   = 9.80

  return (
    <div
      className="font-mono text-[10.5px] leading-[1.45] text-black bg-white p-4 shadow-md rounded border border-slate-200"
      style={{ width: 280, minHeight: 460, fontFamily: "'Courier New', Courier, monospace" }}
    >
      {/* Header */}
      <div className="text-center mb-1 space-y-0.5">
        {t.show_logo && (
          <p className="font-extrabold text-sm tracking-widest">
            {SAMPLE_STORE.toUpperCase()}
          </p>
        )}
        {!t.show_logo && <p className="font-bold">{SAMPLE_STORE}</p>}
        {t.trading_name && t.show_logo && (
          <p className="text-[10px]">{t.trading_name}</p>
        )}
        {t.header_text && <p className="italic text-[10px] mt-0.5">{t.header_text}</p>}
        {t.show_address && <p className="text-[10px]">{SAMPLE_ADDR}</p>}
        {t.show_email   && <p className="text-[10px]">Email: {SAMPLE_EMAIL}</p>}
        {t.show_phone   && <p className="text-[10px]">Tel: {SAMPLE_PHONE}</p>}
      </div>

      <p className="text-[10px]">{HDIV}</p>
      <p className="text-center font-bold tracking-wider text-[10px]">
        {t.receipt_type_label || 'TAX INVOICE/RECEIPT'}
      </p>
      <p className="text-[10px]">{HDIV}</p>

      {/* Meta */}
      <div className="text-[10px] my-0.5 space-y-0">
        <Row l="Date:"      r={SAMPLE_DATE}   />
        <Row l={`${t.number_prefix || 'Invoice#'}:`} r="0042" />
        {t.show_sold_by && <Row l={`${t.label_cashier || 'Served by'}:`} r={SAMPLE_CASHIER} />}
      </div>

      {/* Items */}
      <p className="text-[10px]">{DIV}</p>
      <div className="flex justify-between font-bold text-[10px]">
        <span>{t.label_item || 'Item'}</span>
        <span>{t.label_price || 'Price'}</span>
      </div>
      <p className="text-[10px]">{DIV}</p>
      <div className="space-y-0.5 text-[10px] my-0.5">
        <p className="font-semibold">Rumours Shiraz</p>
        <Row l="  2 x $22.95" r="$45.90" />
        <p className="font-semibold">Rumours Pink Moscato</p>
        <Row l="  1 x $18.50" r="$18.50" />
      </div>

      {/* Totals */}
      <p className="text-[10px]">{DIV}</p>
      <div className="text-[10px] space-y-0 my-0.5">
        <Row l={t.label_subtotal || 'Subtotal'} r={`$${subtotal.toFixed(2)}`} />
        {!t.hide_discount_if_zero && (
          <Row l={t.label_discount || 'Discount'} r="$0.00" />
        )}
        <Row l={t.label_tax || 'VAT'} r={`$${tax.toFixed(2)}`} />
      </div>
      <p className="text-[10px]">{HDIV}</p>
      <Row l={t.label_total || 'Total'} r={`$${total.toFixed(2)}`} bold />
      <p className="text-[10px]">{HDIV}</p>

      {/* Payment */}
      <div className="text-[10px] space-y-0 my-0.5">
        <Row l="Cash" r={`$${cash.toFixed(2)}`} />
        <Row l={t.label_change || 'Change'} r={`$${change.toFixed(2)}`} />
      </div>

      {/* Barcode */}
      {t.show_barcode && (
        <div className="flex flex-col items-center my-1">
          <div className="h-6 w-28 bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,#fff_2px,#fff_4px)] opacity-80" />
          <p className="text-[9px] mt-0.5 tracking-widest">0042-INDULGE</p>
        </div>
      )}

      {/* Loyalty */}
      {t.show_loyalty_points && (
        <div className="text-[10px] border-t border-slate-300 pt-0.5 mt-0.5">
          <Row l="Points Earned" r="+70 pts" />
          <Row l="Points Balance" r="120 pts" />
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px]">{DIV}</p>
      <p className="text-center text-[10px] italic mt-0.5">
        {t.footer_text || 'Thank you for your purchase!'}
      </p>
      <p className="text-[10px]">{DIV}</p>
    </div>
  )
}

// ── Checkbox toggle row ───────────────────────────────────────
function Toggle({
  checked, onChange, label, sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0 cursor-pointer"
      />
      <span>
        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
    </label>
  )
}

// ── Label field ────────────────────────────────────────────────
function LabelField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function ReceiptTemplatePage() {
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [form,       setForm]       = useState<ReceiptTemplateInput>(DEFAULT_TEMPLATE)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    getDefaultReceiptTemplate().then(t => {
      if (t) {
        setTemplateId(t.id)
        setForm({
          name:                  t.name,
          trading_name:          t.trading_name,
          receipt_type_label:    t.receipt_type_label,
          number_prefix:         t.number_prefix,
          header_text:           t.header_text,
          footer_text:           t.footer_text,
          show_logo:             t.show_logo,
          show_address:          t.show_address,
          show_email:            t.show_email,
          show_phone:            t.show_phone,
          show_sold_by:          t.show_sold_by,
          show_barcode:          t.show_barcode,
          hide_discount_if_zero: t.hide_discount_if_zero,
          show_loyalty_points:   t.show_loyalty_points,
          label_item:            t.label_item,
          label_price:           t.label_price,
          label_subtotal:        t.label_subtotal,
          label_discount:        t.label_discount,
          label_tax:             t.label_tax,
          label_total:           t.label_total,
          label_change:          t.label_change,
          label_cashier:         t.label_cashier,
          is_default:            t.is_default,
        })
      }
      setLoading(false)
    })
  }, [])

  function set<K extends keyof ReceiptTemplateInput>(k: K, v: ReceiptTemplateInput[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await saveReceiptTemplate(templateId, form)
      setTemplateId(saved.id)
      toast.success('Receipt template saved')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>

  const sec = 'text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3'
  const inputCls = 'w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSave}>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Receipt Template</h1>
            <p className="text-sm text-slate-500 mt-0.5">Customise how your POS receipts look when printed</p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: form ── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* Template Info */}
          <div className="bg-white border border-blue-100 rounded-xl p-5 space-y-4">
            <p className={sec}>Template Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Template Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Default" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Trading Name (shown on receipt)</label>
                <input value={form.trading_name} onChange={e => set('trading_name', e.target.value)}
                  placeholder="Indulge Pte Limited" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Receipt Type Title</label>
                <input value={form.receipt_type_label} onChange={e => set('receipt_type_label', e.target.value)}
                  placeholder="TAX INVOICE/RECEIPT" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Number Prefix</label>
                <input value={form.number_prefix} onChange={e => set('number_prefix', e.target.value)}
                  placeholder="Invoice#" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-white border border-blue-100 rounded-xl p-5">
            <p className={sec}>Display Options</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Toggle checked={form.show_logo}             onChange={v => set('show_logo',             v)} label="Show logo / store name" />
              <Toggle checked={form.show_address}          onChange={v => set('show_address',          v)} label="Show outlet address" />
              <Toggle checked={form.show_email}            onChange={v => set('show_email',            v)} label="Show outlet email" />
              <Toggle checked={form.show_phone}            onChange={v => set('show_phone',            v)} label="Show outlet phone" />
              <Toggle checked={form.show_sold_by}          onChange={v => set('show_sold_by',          v)} label="Show 'Sold by' cashier" />
              <Toggle checked={form.show_barcode}          onChange={v => set('show_barcode',          v)} label="Show receipt barcode" />
              <Toggle checked={form.show_loyalty_points}   onChange={v => set('show_loyalty_points',   v)} label="Show loyalty points" />
              <Toggle checked={form.hide_discount_if_zero} onChange={v => set('hide_discount_if_zero', v)} label="Hide discount line if $0" />
            </div>
          </div>

          {/* Labels */}
          <div className="bg-white border border-blue-100 rounded-xl p-5">
            <p className={sec}>Receipt Labels</p>
            <div className="grid grid-cols-2 gap-3">
              <LabelField label="Item column"  value={form.label_item}     onChange={v => set('label_item',     v)} placeholder="Item" />
              <LabelField label="Price column" value={form.label_price}    onChange={v => set('label_price',    v)} placeholder="Price" />
              <LabelField label="Subtotal"     value={form.label_subtotal} onChange={v => set('label_subtotal', v)} placeholder="Subtotal" />
              <LabelField label="Discount"     value={form.label_discount} onChange={v => set('label_discount', v)} placeholder="Discount" />
              <LabelField label="Tax / VAT"    value={form.label_tax}      onChange={v => set('label_tax',      v)} placeholder="VAT" />
              <LabelField label="Total"        value={form.label_total}    onChange={v => set('label_total',    v)} placeholder="Total" />
              <LabelField label="Change given" value={form.label_change}   onChange={v => set('label_change',   v)} placeholder="Change" />
              <LabelField label="Cashier line" value={form.label_cashier}  onChange={v => set('label_cashier',  v)} placeholder="Served by" />
            </div>
          </div>

          {/* Header & Footer */}
          <div className="bg-white border border-blue-100 rounded-xl p-5 space-y-4">
            <p className={sec}>Header &amp; Footer</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Header Text <span className="text-slate-400">(shown below store name)</span></label>
              <textarea
                value={form.header_text}
                onChange={e => set('header_text', e.target.value)}
                rows={2}
                placeholder="e.g. Bula! Welcome to Indulge."
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Footer Text <span className="text-slate-400">(shown at bottom of receipt)</span></label>
              <textarea
                value={form.footer_text}
                onChange={e => set('footer_text', e.target.value)}
                rows={2}
                placeholder="Thank you for your purchase!"
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="shrink-0 sticky top-4">
          <div className="bg-white border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Thermal (POS) Preview
            </p>
            <div className="overflow-hidden rounded">
              <ThermalPreview t={form} />
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Preview uses sample data — actual receipt uses real sale values.
            </p>
          </div>
        </div>
      </div>
    </form>
  )
}
