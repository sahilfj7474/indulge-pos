'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/utils'
import { buildZReportData } from '@/lib/services/reports.service'
import Modal from '@/components/ui/Modal'
import { Printer } from 'lucide-react'

type ZData = ReturnType<typeof buildZReportData>

interface Props {
  data: ZData
  type: 'X' | 'Z'
  onClose: () => void
}

export default function ZReportModal({ data, type, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-bold text-sm' : 'text-xs text-slate-600'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  )

  return (
    <Modal title={`${type}-Report — ${data.date}`} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex justify-end mb-3">
        <button
          onClick={() => handlePrint()}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Printer size={14} /> Print {type}-Report
        </button>
      </div>

      <div ref={ref} className="bg-white text-black p-4 font-mono text-xs rounded">
        <div className="text-center mb-3">
          <p className="text-base font-bold">{data.locationName}</p>
          <p className="font-bold">{type === 'X' ? 'X-REPORT (Mid-Day)' : 'Z-REPORT (End of Day)'}</p>
          <p>{data.date}</p>
          <p>Printed by: {data.cashierName}</p>
          <p>{'='.repeat(36)}</p>
        </div>

        <p className="font-bold mb-1">SALES SUMMARY</p>
        <Row label="Total Transactions" value={String(data.totalTransactions)} />
        <Row label="Gross Sales"        value={formatCurrency(data.totalSales)} />
        <Row label="Total Discount"     value={`-${formatCurrency(data.totalDiscount)}`} />
        <Row label="Net Sales"          value={formatCurrency(data.netSales)} bold />
        <Row label="Tax Collected"      value={formatCurrency(data.totalTax)} />

        <p className="mt-3 mb-1">{'='.repeat(36)}</p>
        <p className="font-bold mb-1">PAYMENT BREAKDOWN</p>
        <Row label="Cash"          value={formatCurrency(data.cashSales)} />
        <Row label="Card / EFTPOS" value={formatCurrency(data.cardSales)} />
        <Row label="Bank Transfer" value={formatCurrency(data.bankSales)} />
        <Row label="Loyalty Points" value={formatCurrency(data.loyaltySales)} />

        {data.topProducts.length > 0 && (
          <>
            <p className="mt-3 mb-1">{'='.repeat(36)}</p>
            <p className="font-bold mb-1">TOP PRODUCTS</p>
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="truncate flex-1">{i + 1}. {p.name}</span>
                <span className="ml-2">{p.qty} sold · {formatCurrency(p.total)}</span>
              </div>
            ))}
          </>
        )}

        <p className="mt-3">{'='.repeat(36)}</p>
        <p className="text-center text-xs mt-1">
          {type === 'Z' ? '*** END OF DAY CLOSED ***' : '*** MID-DAY SNAPSHOT ***'}
        </p>
      </div>
    </Modal>
  )
}