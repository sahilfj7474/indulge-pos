'use client'

import { useState } from 'react'
import { CartItem, Customer } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Minus, Plus, Trash2, Tag, MessageSquare, PauseCircle, Zap } from 'lucide-react'
import CustomerSearch from './CustomerSearch'

export const DEFAULT_TAX_RATE = 0.09

export function computeTotals(
  items: CartItem[],
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  loyaltyPointsRedeemed: number,
  surchargeAmount = 0,
  taxRate = DEFAULT_TAX_RATE,
  taxInclusive = false
) {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount_amount, 0)
  const discountAmount =
    discountType === 'percentage'
      ? (subtotal * discountValue) / 100
      : Math.min(discountValue, subtotal)
  const loyaltyDiscount = loyaltyPointsRedeemed
  const taxable = Math.max(0, subtotal - discountAmount - loyaltyDiscount)

  let taxAmount: number
  let total: number

  if (taxInclusive) {
    // Tax is already included in the price — extract it for display
    taxAmount = taxable * (taxRate / (1 + taxRate))
    total = taxable + surchargeAmount
  } else {
    taxAmount = taxable * taxRate
    total = taxable + taxAmount + surchargeAmount
  }

  return { subtotal, discountAmount, loyaltyDiscount, taxAmount, surchargeAmount, total }
}

interface Props {
  items: CartItem[]
  customer: Customer | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  loyaltyPointsToRedeem: number
  taxRate?: number
  taxInclusive?: boolean
  appliedPromoName?: string | null
  onCustomerChange: (c: Customer | null) => void
  onQtyChange: (index: number, qty: number) => void
  onRemove: (index: number) => void
  onNoteChange: (index: number, note: string) => void
  onDiscountTypeChange: (t: 'percentage' | 'fixed') => void
  onDiscountValueChange: (v: number) => void
  onLoyaltyRedeemChange: (points: number) => void
  onCharge: () => void
  onClear: () => void
  onHold: () => void
}

export default function Cart({
  items,
  customer,
  discountType,
  discountValue,
  loyaltyPointsToRedeem,
  taxRate = DEFAULT_TAX_RATE,
  taxInclusive = false,
  appliedPromoName,
  onCustomerChange,
  onQtyChange,
  onRemove,
  onNoteChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onLoyaltyRedeemChange,
  onCharge,
  onClear,
  onHold,
}: Props) {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null)
  const [editingQtyValue, setEditingQtyValue] = useState('')
  const { subtotal, discountAmount, loyaltyDiscount, taxAmount, total } = computeTotals(
    items, discountType, discountValue, loyaltyPointsToRedeem, 0, taxRate, taxInclusive
  )
  const maxRedeem = customer ? Math.min(customer.loyalty_points, Math.floor(subtotal - discountAmount)) : 0
  const taxPct = +(taxRate * 100).toFixed(4)
  const taxLabel = `${taxPct}% VAT`

  // For display: convert to ex-tax amounts when prices are tax-inclusive
  // so the receipt reads: Subtotal (ex-VAT) + VAT = Total
  const displayFactor  = taxInclusive ? 1 / (1 + taxRate) : 1
  const displaySubtotal = subtotal * displayFactor
  const displayDiscount = discountAmount * displayFactor

  function toggleNote(i: number) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function startEditQty(i: number, current: number) {
    setEditingQtyIndex(i)
    setEditingQtyValue(String(current))
  }

  function commitEditQty(i: number) {
    const qty = parseInt(editingQtyValue, 10)
    if (!isNaN(qty) && qty > 0) onQtyChange(i, qty)
    setEditingQtyIndex(null)
    setEditingQtyValue('')
  }

  function handleQtyKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter') commitEditQty(i)
    if (e.key === 'Escape') { setEditingQtyIndex(null); setEditingQtyValue('') }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-blue-100">
      {/* Customer */}
      <div className="p-3 border-b border-blue-100">
        <CustomerSearch selected={customer} onSelect={onCustomerChange} />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Cart is empty
          </div>
        )}
        {items.map((item, i) => (
          <div key={`${item.product.id}-${i}`} className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900 leading-tight flex-1">{item.product.name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleNote(i)}
                  title="Add note"
                  className={cn('w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-blue-500 hover:bg-blue-100', expandedNotes.has(i) && 'text-blue-500')}
                >
                  <MessageSquare size={15} />
                </button>
                <button
                  onClick={() => onRemove(i)}
                  className="w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onQtyChange(i, item.quantity - 1)}
                  className="w-11 h-11 rounded-lg bg-blue-100 hover:bg-blue-200 active:bg-blue-300 flex items-center justify-center"
                >
                  <Minus size={16} />
                </button>

                {/* Tap quantity to type a number directly */}
                {editingQtyIndex === i ? (
                  <input
                    type="number"
                    autoFocus
                    min={1}
                    value={editingQtyValue}
                    onChange={e => setEditingQtyValue(e.target.value)}
                    onBlur={() => commitEditQty(i)}
                    onKeyDown={e => handleQtyKeyDown(e, i)}
                    className="w-12 h-11 text-base font-semibold text-center text-slate-900 bg-white border-2 border-blue-500 rounded-lg focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startEditQty(i, item.quantity)}
                    title="Tap to set quantity"
                    className="w-12 h-11 text-base font-semibold text-center text-slate-900 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg border border-blue-200 transition-colors"
                  >
                    {item.quantity}
                  </button>
                )}

                <button
                  onClick={() => onQtyChange(i, item.quantity + 1)}
                  className="w-11 h-11 rounded-lg bg-blue-100 hover:bg-blue-200 active:bg-blue-300 flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(item.unit_price * item.quantity - item.discount_amount)}
                </p>
                <p className="text-xs text-slate-400">{formatCurrency(item.unit_price)} each</p>
              </div>
            </div>
            {expandedNotes.has(i) && (
              <input
                type="text"
                value={item.note}
                onChange={e => onNoteChange(i, e.target.value)}
                placeholder="Note for this item..."
                className="mt-2 w-full px-3 py-2 bg-blue-100 border border-blue-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* Discount + Surcharge */}
      {items.length > 0 && (
        <div className="px-3 py-2 border-t border-blue-100 space-y-2">
          {/* Auto-applied promo badge */}
          {appliedPromoName && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-800/50 rounded-lg">
              <Zap size={11} className="text-green-600" />
              <span className="text-xs text-green-600">Promo: {appliedPromoName}</span>
            </div>
          )}

          {/* Discount */}
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 flex-1">Discount</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDiscountTypeChange('percentage')}
                className={cn('w-9 h-9 text-sm font-bold rounded', discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-slate-500')}
              >%</button>
              <button
                onClick={() => onDiscountTypeChange('fixed')}
                className={cn('w-9 h-9 text-sm font-bold rounded', discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-slate-500')}
              >$</button>
            </div>
            <input
              type="number"
              min={0}
              value={discountValue || ''}
              onChange={e => onDiscountValueChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* Loyalty redemption */}
          {customer && customer.loyalty_points > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 flex-1">Redeem points ({customer.loyalty_points} avail.)</span>
              <input
                type="number"
                min={0}
                max={maxRedeem}
                value={loyaltyPointsToRedeem || ''}
                onChange={e => onLoyaltyRedeemChange(Math.min(maxRedeem, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1.5 bg-blue-50 border border-blue-700 rounded text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="px-3 py-3 border-t border-blue-100 space-y-1.5">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal</span><span>{formatCurrency(displaySubtotal)}</span>
        </div>
        {displayDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span><span>-{formatCurrency(displayDiscount)}</span>
          </div>
        )}
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-sm text-blue-500">
            <span>Points redeemed</span><span>-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-slate-500">
          <span>{taxLabel}</span><span>{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-slate-900 border-t border-blue-200 pt-1.5 mt-1">
          <span>Total</span>
          <span className="text-blue-500">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={items.length === 0}
            className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 disabled:opacity-40 text-slate-600 text-sm font-semibold rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onHold}
            disabled={items.length === 0}
            title="Hold order"
            className="px-4 py-3 bg-blue-50 hover:bg-amber-50 active:bg-amber-100 disabled:opacity-40 text-amber-600 text-sm font-medium rounded-lg transition-colors"
          >
            <PauseCircle size={18} />
          </button>
        </div>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white text-base font-bold rounded-lg transition-colors"
        >
          Charge {items.length > 0 ? formatCurrency(total) : ''}
        </button>
      </div>
    </div>
  )
}