'use client'

import { useRef, useState, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Location } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { fetchSalesForReport, buildZReportData } from '@/lib/services/reports.service'
import MultiLocationPicker from '@/components/ui/MultiLocationPicker'
import Modal from '@/components/ui/Modal'
import { Printer } from 'lucide-react'

type ZData = ReturnType<typeof buildZReportData>

interface Props {
  type: 'X' | 'Z'
  locations: Location[]
  initialSelectedIds: string[]
  dateFrom: string
  dateTo: string
  cashierName: string
  onClose: () => void
}

export default function ZReportModal({
  type, locations, initialSelectedIds, dateFrom, dateTo, cashierName, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [data,        setData]        = useState<ZData | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const sales = await fetchSalesForReport(selectedIds, dateFrom, dateTo)
      if (cancelled) return
      const locationLabel =
        selectedIds.length === 0
          ? 'All Stores'
          : selectedIds.length === 1
          ? (locations.find(l => l.id === selectedIds[0])?.name ?? 'Store')
          : `${selectedIds.length} Stores`
      const date = dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`
      setData(buildZReportData(sales, locationLabel, date, cashierName))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [JSON.stringify(selectedIds), dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-bold text-sm' : 'text-xs'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  )

  return (
    <Modal title={`${type}-Report`} onClose={onClose} maxWidth="max-w-sm">

      {/* Store selector */}
      {locations.length > 1 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Store selection</p>
          <MultiLocationPicker
            locations={locations}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
          />
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button
          onClick={() => handlePrint()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          <Printer size={14} /> Print {type}-Report
        </button>
      </div>

      {loading || !data ? (
        <p className="text-center text-slate-400 text-sm py-6">Loading…</p>
      ) : (
        <div ref={ref} className="bg-white text-black p-4 font-mono text-xs rounded font-semibold">
          <div className="text-center mb-3">
            <p className="text-base font-bold">{data.locationName}</p>
            <p className="font-bold">{type === 'X' ? 'X-REPORT (Mid-Day)' : 'Z-REPORT (End of Day)'}</p>
            <p>{data.date}</p>
            <p>Printed by: {data.cashierName}</p>
            <div className="border-t-2 border-black my-1" />
          </div>

          <p className="font-bold mb-1">SALES SUMMARY</p>
          <Row label="Total Transactions" value={String(data.totalTransactions)} />
          <Row label="Gross Sales"        value={formatCurrency(data.totalSales)} />
          <Row label="Total Discount"     value={`-${formatCurrency(data.totalDiscount)}`} />
          <Row label="Net Sales"          value={formatCurrency(data.netSales)} bold />
          <Row label="Tax Collected"      value={formatCurrency(data.totalTax)} />

          <div className="border-t-2 border-black my-2" />
          <p className="font-bold mb-1">PAYMENT BREAKDOWN</p>
          <Row label="Cash"           value={formatCurrency(data.cashSales)} />
          <Row label="Card / EFTPOS"  value={formatCurrency(data.cardSales)} />
          <Row label="Bank Transfer"  value={formatCurrency(data.bankSales)} />
          <Row label="Loyalty Points" value={formatCurrency(data.loyaltySales)} />

          {data.topProducts.length > 0 && (
            <>
              <div className="border-t-2 border-black my-2" />
              <p className="font-bold mb-1">TOP PRODUCTS</p>
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="truncate flex-1">{i + 1}. {p.name}</span>
                  <span className="ml-2 shrink-0">{p.qty} sold · {formatCurrency(p.total)}</span>
                </div>
              ))}
            </>
          )}

          <div className="border-t-2 border-black my-2" />
          <p className="text-center text-xs mt-1 font-bold">
            {type === 'Z' ? '*** END OF DAY CLOSED ***' : '*** MID-DAY SNAPSHOT ***'}
          </p>

          {/* Print-only font boost */}
          <style>{`
            @media print {
              body > * { display: none !important; }
              .font-mono {
                display: block !important;
                font-family: 'Courier New', Courier, monospace;
                font-weight: 600;
                font-size: 12px;
                color: #000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .font-mono * { color: #000 !important; }
            }
          `}</style>
        </div>
      )}
    </Modal>
  )
}
