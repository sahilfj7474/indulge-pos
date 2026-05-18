'use client'

import { useState } from 'react'
import { CartItem, Customer } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Minus, Plus, Trash2, Tag, MessageSquare, PauseCircle, Percent, Zap } from 'lucide-react'
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
  surchargeAmount: number
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
  onSurchargeChange: (v: number) => void
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
  surchargeAmount,
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
  onSurchargeChange,
  onCharge,
  onClear,
  onHold,
}: Props) {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const { subtotal, discountAmount, loyaltyDiscount, taxAmount, total } = computeTotals(
    items, discountType, discountValue, loyaltyPointsToRedeem, surchargeAmount, taxRate, taxInclusive
  )
  const maxRedeem = customer ? Math.min(customer.loyalty_points, Math.floor(subtotal - discountAmount)) : 0
  const taxLabel = `${(taxRate * 100).toFixed(0)}% VAT${taxInclusive ? ' (incl.)' : ''}`

  function toggleNote(i: number) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
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
          <div key={`${item.product.id}-${i}`} className="bg-blue-50 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900 leading-tight flex-1">{item.product.name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleNote(i)}
                  title="Add note"
                  className={cn('text-slate-400 hover:text-blue-500', expandedNotes.has(i) && 'text-blue-500')}
                >
                  <MessageSquare size={13} />
                </button>
                <button onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onQtyChange(i, item.quantity - 1)}
                  className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center"
                >
                  <Minus size={11} />
                </button>
                <span className="text-sm w-5 text-center text-slate-900">{item.quantity}</span>
                <button
                  onClick={() => onQtyChange(i, item.quantity + 1)}
                  className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center"
                >
                  <Plus size={11} />
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
                className="mt-2 w-full px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/30 border border-green-800/50 rounded-lg">
              <Zap size={11} className="text-green-400" />
              <span className="text-xs text-green-400">Promo: {appliedPromoName}</span>
            </div>
          )}

          {/* Discount */}
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 flex-1">Discount</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDiscountTypeChange('percentage')}
                className={cn('px-2 py-0.5 text-xs rounded', discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-slate-500')}
              >%</button>
              <button
                onClick={() => onDiscountTypeChange('fixed')}
                className={cn('px-2 py-0.5 text-xs rounded', discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-slate-500')}
              >$</button>
            </div>
            <input
              type="number"
              min={0}
              value={discountValue || ''}
              onChange={e => onDiscountValueChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* Surcharge */}
          <div className="flex items-center gap-2">
            <Percent size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 flex-1">Surcharge</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={surchargeAmount || ''}
              onChange={e => onSurchargeChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.00"
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
                className="w-16 px-2 py-0.5 bg-blue-50 border border-blue-700 rounded text-sm text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="px-3 py-3 border-t border-blue-100 space-y-1.5">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>Discount</span><span>-{formatCurrency(discountAmount)}</span>
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
        {surchargeAmount > 0 && (
          <div className="flex justify-between text-sm text-yellow-400">
            <span>Surcharge</span><span>+{formatCurrency(surchargeAmount)}</span>
          </div>
        )}
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
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onHold}
            disabled={items.length === 0}
            title="Hold order"
            className="px-3 py-2 bg-blue-50 hover:bg-amber-900/40 disabled:opacity-40 text-amber-400 text-sm font-medium rounded-lg transition-colors"
          >
            <PauseCircle size={16} />
          </button>
        </div>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Charge {items.length > 0 ? formatCurrency(total) : ''}
        </button>
      </div>
    </div>
  )
}