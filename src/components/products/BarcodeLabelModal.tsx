'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Printer } from 'lucide-react'

interface Props {
  product: Product
  onClose: () => void
}

export default function BarcodeLabelModal({ product, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: ref })

  return (
    <Modal title="Print Barcode Label" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Preview below. Click Print to send to your label printer.</p>

        {/* Label preview */}
        <div className="flex justify-center">
          <div ref={ref} className="label-print-area bg-white text-black border-2 border-dashed border-gray-300 rounded" style={{ width: '240px', padding: '10px', fontFamily: 'monospace' }}>
            <div className="text-center" style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: 1.2, marginBottom: '4px' }}>
              {product.name}
            </div>
            {product.sku && (
              <div className="text-center" style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>
                SKU: {product.sku}
              </div>
            )}
            {/* Barcode representation */}
            <div className="text-center" style={{ margin: '6px 0' }}>
              {product.barcode ? (
                <>
                  {/* Simple barcode bars visualization */}
                  <div style={{ display: 'inline-block', height: '40px', position: 'relative' }}>
                    {product.barcode.split('').map((char, i) => {
                      const width = (parseInt(char) % 3) + 1
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'inline-block',
                            width: `${width}px`,
                            height: i % 2 === 0 ? '40px' : '30px',
                            backgroundColor: i % 2 === 0 ? 'black' : 'transparent',
                            marginRight: '1px',
                            verticalAlign: 'bottom',
                          }}
                        />
                      )
                    })}
                  </div>
                  <div style={{ fontSize: '10px', letterSpacing: '2px', marginTop: '2px' }}>
                    {product.barcode}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '9px', color: '#888' }}>No barcode assigned</div>
              )}
            </div>
            <div className="text-center" style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
              {formatCurrency(product.price)}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg">
            Cancel
          </button>
          <button onClick={() => handlePrint()}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg">
            <Printer size={14} /> Print Label
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .label-print-area {
            display: block !important;
            border: 1px solid black !important;
          }
        }
      `}</style>
    </Modal>
  )
}
