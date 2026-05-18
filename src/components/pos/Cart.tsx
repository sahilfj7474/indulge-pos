'use client'

import { useState } from 'react'
import { CartItem, Customer } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Minus, Plus, Trash2, Tag, MessageSquare, PauseCircle, Percent } from 'lucide-react'
import CustomerSearch from './CustomerSearch'

export const TAX_RATE = 0.09

interface Props {
  items: CartItem[]
  customer: Customer | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  loyaltyPointsToRedeem: number
  surchargeAmount: number
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

export function computeTotals(
  items: CartItem[],
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  loyaltyPointsRedeemed: number,
  surchargeAmount = 0
) {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount_amount, 0)
  const discountAmount =
    discountType === 'percentage'
      ? (subtotal * discountValue) / 100
      : Math.min(discountValue, subtotal)
  const loyaltyDiscount = loyaltyPointsRedeemed
  const taxable = Math.max(0, subtotal - discountAmount - loyaltyDiscount)
  const taxAmount = taxable * TAX_RATE
  const total = taxable + taxAmount + surchargeAmount
  return { subtotal, discountAmount, loyaltyDiscount, taxAmount, surchargeAmount, total }
}

export default function Cart({
  items,
  customer,
  discountType,
  discountValue,
  loyaltyPointsToRedeem,
  surchargeAmount,
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
    items, discountType, discountValue, loyaltyPointsToRedeem, surchargeAmount
  )
  const maxRedeem = customer ? Math.min(customer.loyalty_points, Math.floor(subtotal - discountAmount)) : 0

  function toggleNote(i: number) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      {/* Customer */}
      <div className="p-3 border-b border-gray-800">
        <CustomerSearch selected={customer} onSelect={onCustomerChange} />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Cart is empty
          </div>
        )}
        {items.map((item, i) => (
          <div key={`${item.product.id}-${i}`} className="bg-gray-800 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-white leading-tight flex-1">{item.product.name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleNote(i)}
                  title="Add note"
                  className={cn('text-gray-500 hover:text-indigo-400', expandedNotes.has(i) && 'text-indigo-400')}
                >
                  <MessageSquare size={13} />
                </button>
                <button onClick={() => onRemove(i)} className="text-gray-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onQtyChange(i, item.quantity - 1)}
                  className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
                >
                  <Minus size={11} />
                </button>
                <span className="text-sm w-5 text-center text-white">{item.quantity}</span>
                <button
                  onClick={() => onQtyChange(i, item.quantity + 1)}
                  className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
                >
                  <Plus size={11} />
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(item.unit_price * item.quantity - item.discount_amount)}
                </p>
                <p className="text-xs text-gray-500">{formatCurrency(item.unit_price)} each</p>
              </div>
            </div>
            {expandedNotes.has(i) && (
              <input
                type="text"
                value={item.note}
                onChange={e => onNoteChange(i, e.target.value)}
                placeholder="Note for this item..."
                className="mt-2 w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* Discount + Surcharge */}
      {items.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800 space-y-2">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-gray-400" />
            <span className="text-xs text-gray-400 flex-1">Discount</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDiscountTypeChange('percentage')}
                className={cn('px-2 py-0.5 text-xs rounded', discountType === 'percentage' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400')}
              >%</button>
              <button
                onClick={() => onDiscountTypeChange('fixed')}
                className={cn('px-2 py-0.5 text-xs rounded', discountType === 'fixed' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400')}
              >$</button>
            </div>
            <input
              type="number"
              min={0}
              value={discountValue || ''}
              onChange={e => onDiscountValueChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0"
            />
          </div>

          {/* Surcharge */}
          <div className="flex items-center gap-2">
            <Percent size={13} className="text-gray-400" />
            <span className="text-xs text-gray-400 flex-1">Surcharge</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={surchargeAmount || ''}
              onChange={e => onSurchargeChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>

          {/* Loyalty redemption */}
          {customer && customer.loyalty_points > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-400 flex-1">Redeem points ({customer.loyalty_points} avail.)</span>
              <input
                type="number"
                min={0}
                max={maxRedeem}
                value={loyaltyPointsToRedeem || ''}
                onChange={e => onLoyaltyRedeemChange(Math.min(maxRedeem, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-0.5 bg-gray-800 border border-indigo-700 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="px-3 py-3 border-t border-gray-800 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>Discount</span><span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-sm text-indigo-400">
            <span>Points redeemed</span><span>-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-400">
          <span>Tax (9% GST)</span><span>{formatCurrency(taxAmount)}</span>
        </div>
        {surchargeAmount > 0 && (
          <div className="flex justify-between text-sm text-yellow-400">
            <span>Surcharge</span><span>+{formatCurrency(surchargeAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-white border-t border-gray-700 pt-1.5 mt-1">
          <span>Total</span>
          <span className="text-indigo-400">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={items.length === 0}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onHold}
            disabled={items.length === 0}
            title="Hold order"
            className="px-3 py-2 bg-gray-800 hover:bg-amber-900/40 disabled:opacity-40 text-amber-400 text-sm font-medium rounded-lg transition-colors"
          >
            <PauseCircle size={16} />
          </button>
        </div>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Charge {items.length > 0 ? formatCurrency(total) : ''}
        </button>
      </div>
    </div>
  )
}
