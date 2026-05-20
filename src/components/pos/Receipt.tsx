'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Sale, CartItem, Customer, Location, User } from '@/types'
import { SplitPayment } from '@/lib/services/pos.service'
import { ReceiptTemplate } from '@/lib/services/receipt-template.service'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { X, Printer } from 'lucide-react'

interface Props {
  sale: Sale
  items: CartItem[]
  customer: Customer | null
  location: Location
  cashier: User
  amountTendered: number
  loyaltyPointsRedeemed: number
  loyaltyPointsEarned: number
  splitPayments?: SplitPayment[]
  settings?: Record<string, string>
  template?: ReceiptTemplate | null
  taxRate?: number
  taxInclusive?: boolean
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ThinRule = () => (
  <div className="border-0 border-t border-dashed border-black my-0.5 w-full" />
)
const ThickRule = () => (
  <div className="border-0 border-t-2 border-black my-0.5 w-full" />
)

function Row({ label, value, bold, className }: {
  label: string; value: string; bold?: boolean; className?: string
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${className ?? ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Receipt({
  sale,
  items,
  customer,
  location,
  cashier,
  amountTendered,
  loyaltyPointsRedeemed,
  loyaltyPointsEarned,
  splitPayments,
  settings = {},
  template,
  taxRate = 0.09,
  taxInclusive = false,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  const change = sale.payment_method === 'cash'
    ? Math.max(0, amountTendered - sale.total)
    : 0
  const surcharge = (sale as any).surcharge_amount ?? 0

  // Template overrides settings, settings overrides defaults
  const storeName      = template?.trading_name      || settings.store_name      || location.name
  const businessAddr   = (template?.show_address     ?? true)  ? (settings.business_address || location.address || '') : ''
  const businessPhone  = (template?.show_phone       ?? true)  ? (settings.business_phone   || location.phone   || '') : ''
  const businessEmail  = (template?.show_email       ?? true)  ? (settings.business_email   || '') : ''
  const vatNumber      = settings.vat_number       || ''
  const receiptHeader  = template?.header_text       ?? settings.receipt_header   ?? ''
  const receiptFooter  = template?.footer_text       ?? settings.receipt_footer   ?? 'Thank you for your purchase!'
  const receiptTitle   = template?.receipt_type_label ?? 'TAX INVOICE'
  const numPrefix      = template?.number_prefix      ?? ''
  const showSoldBy     = template?.show_sold_by       ?? true
  const showBarcode    = template?.show_barcode        ?? false
  const showLoyalty    = template?.show_loyalty_points ?? true
  const hideDiscIfZero = template?.hide_discount_if_zero ?? true

  const lItem     = template?.label_item     || 'Item'
  const lPrice    = template?.label_price    || 'Price'
  const lSubtotal = template?.label_subtotal || 'Subtotal'
  const lDiscount = template?.label_discount || 'Discount'
  const lTax      = template?.label_tax      || 'VAT'
  const lTotal    = template?.label_total    || 'TOTAL'
  const lChange   = template?.label_change   || 'Change'
  const lCashier  = template?.label_cashier  || 'Served by'

  const taxPct  = +(taxRate * 100).toFixed(4)
  const taxLabel = `${taxPct}% ${lTax}`

  // Convert to ex-tax amounts for display so receipt reads: Subtotal + VAT = Total
  const displayFactor      = taxInclusive ? 1 / (1 + taxRate) : 1
  // sale.discount_amount = cart discount + loyalty combined; split them out
  const cartDiscountAmount = Math.max(0, sale.discount_amount - loyaltyPointsRedeemed)
  const displaySubtotal    = sale.subtotal * displayFactor
  const displayDiscount    = cartDiscountAmount * displayFactor

  const dateStr    = formatDateTime(sale.created_at)
  const receiptNum = sale.id.slice(0, 8).toUpperCase()

  return (
    <div className="fixed inset-0 bg-blue-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-blue-200 rounded-xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable receipt area */}
        <div className="overflow-y-auto p-4">
          {/* ── Printable content ────────────────────────────── */}
          <div
            ref={ref}
            className="receipt-print bg-white text-black font-mono text-[11px] leading-snug"
            style={{ width: '100%', maxWidth: 320 }}
          >
            {/* ── HEADER ── */}
            <div className="text-center mb-1">
              {(template?.show_logo ?? true) && (
                <img
                  src="/logo-black.png"
                  alt="Indulge"
                  className="h-12 w-auto mx-auto mb-1 object-contain"
                />
              )}
              <p className="font-bold text-sm tracking-wide">{storeName.toUpperCase()}</p>
              {businessAddr  && <p>{businessAddr}</p>}
              {businessPhone && <p>Tel: {businessPhone}</p>}
              {businessEmail && <p>{businessEmail}</p>}
              {vatNumber     && <p>VAT Reg: {vatNumber}</p>}
              {receiptHeader && <p className="mt-0.5 italic">{receiptHeader}</p>}
            </div>

            {/* ── Receipt title ── */}
            <ThickRule />
            <p className="text-center font-bold tracking-widest">{receiptTitle}</p>
            <ThickRule />

            {/* ── Transaction meta ── */}
            <div className="space-y-0.5 my-1">
              <Row label="Date:"     value={dateStr}   />
              <Row label={`${numPrefix ? numPrefix + ':' : 'Receipt#:'}`} value={receiptNum} />
              {showSoldBy && <Row label={`${lCashier}:`} value={cashier.full_name} />}
              {customer && <Row label="Customer:" value={customer.full_name} />}
            </div>

            {/* ── Items ── */}
            <ThinRule />
            <div className="flex justify-between font-bold my-0.5">
              <span>{lItem}</span>
              <span>{lPrice}</span>
            </div>
            <ThinRule />

            <div className="space-y-1.5 my-1">
              {items.map((item, i) => {
                const lineTotal = item.unit_price * item.quantity - item.discount_amount
                return (
                  <div key={i}>
                    <p className="font-semibold truncate">{item.product.name}</p>
                    <Row
                      label={`  ${item.quantity} x ${formatCurrency(item.unit_price)}`}
                      value={formatCurrency(lineTotal)}
                    />
                    {item.discount_amount > 0 && (
                      <p className="pl-2">  Disc: -{formatCurrency(item.discount_amount)}</p>
                    )}
                    {item.note && (
                      <p className="pl-2 italic">  * {item.note}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Totals ── */}
            <ThinRule />
            <div className="space-y-0.5 my-1">
              <Row label={lSubtotal} value={formatCurrency(displaySubtotal)} />
              {(displayDiscount > 0 || !hideDiscIfZero) && (
                <Row label={lDiscount} value={displayDiscount > 0 ? `-${formatCurrency(displayDiscount)}` : formatCurrency(0)} />
              )}
              {loyaltyPointsRedeemed > 0 && (
                <Row label="Points Redeemed" value={`-${formatCurrency(loyaltyPointsRedeemed)}`} />
              )}
              <Row label={taxLabel} value={formatCurrency(sale.tax_amount)} />
              {surcharge > 0 && (
                <Row label="Surcharge" value={`+${formatCurrency(surcharge)}`} />
              )}
            </div>
            <ThickRule />
            <div className="flex justify-between font-bold text-sm my-1 tracking-wide">
              <span>{lTotal}</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
            <ThickRule />

            {/* ── Payment ── */}
            <div className="space-y-0.5 my-1">
              {splitPayments && splitPayments.length > 0 ? (
                <>
                  <p className="font-semibold">SPLIT PAYMENT:</p>
                  {splitPayments.map((sp, i) => (
                    <Row
                      key={i}
                      label={`  ${sp.method.replace(/_/g, ' ').toUpperCase()}`}
                      value={formatCurrency(sp.amount)}
                    />
                  ))}
                </>
              ) : sale.payment_method === 'account' ? (
                <>
                  <Row label="Charged to Account" value={formatCurrency(sale.total)} />
                  {customer && <p className="pl-2 italic">  {customer.full_name}</p>}
                </>
              ) : (
                <>
                  <Row
                    label="Payment Method"
                    value={sale.payment_method.replace(/_/g, ' ').toUpperCase()}
                  />
                  {surcharge > 0 && (
                    <Row label="  Incl. Surcharge" value={`+${formatCurrency(surcharge)}`} />
                  )}
                  {sale.payment_method === 'cash' && (
                    <>
                      <Row label="Tendered" value={formatCurrency(amountTendered)} />
                      <Row label={lChange}  value={formatCurrency(change)} bold />
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── Loyalty ── */}
            {customer && showLoyalty && (
              <>
                <ThinRule />
                <div className="space-y-0.5 my-1">
                  {loyaltyPointsEarned > 0 && (
                    <Row label="Points Earned" value={`+${loyaltyPointsEarned} pts`} />
                  )}
                  <Row
                    label="Points Balance"
                    value={`${customer.loyalty_points + loyaltyPointsEarned - loyaltyPointsRedeemed} pts`}
                  />
                </div>
              </>
            )}

            {/* ── Footer ── */}
            <ThinRule />
            <div className="text-center my-1 space-y-0.5">
              <p className="font-bold">* {receiptFooter} *</p>
              <p>Please visit us again!</p>
            </div>
            <ThinRule />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .receipt-print {
            display: block !important;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            width: 100%;
            padding: 4px;
          }
        }
      `}</style>
    </div>
  )
}
