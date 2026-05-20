/**
 * Professional Excel export utility for Indulge POS
 * Uses exceljs to generate fully styled .xlsx files with:
 *   - Branded header banner
 *   - Report title, location(s), date period, generated-by
 *   - Styled column headers (dark blue + white bold)
 *   - Alternating row fills
 *   - Numeric / currency formatting
 *   - Bold totals row with top/bottom border
 *   - Multi-sheet support
 */

import ExcelJS from 'exceljs'

// ── Brand palette (ARGB — first two chars = alpha, always FF for opaque) ────
const C_BRAND_PRIMARY = 'FF2563EB'  // blue-600   (banner bg)
const C_BRAND_DARK    = 'FF1E3A5F'  // dark navy  (title row)
const C_BRAND_LIGHT   = 'FFEFF6FF'  // blue-50    (meta rows + even data rows)
const C_HEADER_BG     = 'FF1E40AF'  // blue-800   (column header row)
const C_TOTALS_BG     = 'FFDBEAFE'  // blue-100   (totals row)
const C_BORDER        = 'FFBFDBFE'  // blue-200   (row borders)
const C_BORDER_ACCENT = 'FF2563EB'  // blue-600   (totals top/bottom border)
const C_WHITE         = 'FFFFFFFF'
const C_TEXT_DARK     = 'FF0F172A'  // slate-900
const C_TEXT_MUTED    = 'FF64748B'  // slate-500
const C_META_BG       = 'FFF8FAFC'  // slate-50   (generated-by row)

// ── Types ────────────────────────────────────────────────────────────────────

export type ExcelColType = 'text' | 'currency' | 'number' | 'integer' | 'percent' | 'date'
export type ExcelColAlign = 'left' | 'right' | 'center'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
  type?: ExcelColType
  /** Override default alignment (numeric → right, else → left) */
  align?: ExcelColAlign
}

export interface ExcelSheet {
  name: string
  columns: ExcelColumn[]
  /** Plain objects — keys must match column `key` values */
  data: Record<string, unknown>[]
  /** Optional totals row.  Keys match column keys; omit a key to leave cell blank */
  totals?: Record<string, unknown>
}

export interface ExcelExportOptions {
  filename: string
  reportTitle: string
  /** e.g. "All Stores" | "Store 1" | "Store 1, Store 2, Store 3" */
  locationLabel: string
  dateFrom: string
  dateTo: string
  generatedBy: string
  sheets: ExcelSheet[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numFmtFor(type: ExcelColType | undefined): string {
  switch (type) {
    case 'currency': return '#,##0.00'
    case 'number':   return '#,##0.00'
    case 'integer':  return '#,##0'
    case 'percent':  return '0.0"%"'
    default:         return '@'   // text
  }
}

function alignFor(col: ExcelColumn): ExcelJS.Alignment['horizontal'] {
  if (col.align) return col.align
  if (col.type === 'currency' || col.type === 'number' || col.type === 'integer' || col.type === 'percent') return 'right'
  return 'left'
}

function coerceNum(val: unknown): number {
  if (typeof val === 'number') return val
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

function cellValue(val: unknown, type: ExcelColType | undefined): ExcelJS.CellValue {
  if (type === 'currency' || type === 'number' || type === 'percent') return coerceNum(val)
  if (type === 'integer') return Math.round(coerceNum(val))
  if (val === null || val === undefined) return ''
  return String(val)
}

// ── Main export function ───────────────────────────────────────────────────────

export async function exportToExcel(opts: ExcelExportOptions): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Indulge POS'
  wb.created  = new Date()
  wb.modified = new Date()

  for (const sheet of opts.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      pageSetup: {
        orientation:  'landscape',
        fitToPage:    true,
        fitToWidth:   1,
        fitToHeight:  0,
        paperSize:    9,          // A4
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    })

    const NCOLS = sheet.columns.length

    // Tell exceljs about column widths (keys don't matter — we set cells by index)
    ws.columns = sheet.columns.map(c => ({ width: c.width ?? 16 }))

    // ── ROW 1: System banner ─────────────────────────────────────────────────
    ws.mergeCells(1, 1, 1, NCOLS)
    const banner = ws.getCell(1, 1)
    banner.value     = 'INDULGE POS SYSTEM'
    banner.font      = { name: 'Calibri', size: 18, bold: true, color: { argb: C_WHITE } }
    banner.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BRAND_PRIMARY } }
    banner.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 36

    // ── ROW 2: Report title ──────────────────────────────────────────────────
    ws.mergeCells(2, 1, 2, NCOLS)
    const title = ws.getCell(2, 1)
    title.value     = opts.reportTitle
    title.font      = { name: 'Calibri', size: 14, bold: true, color: { argb: C_WHITE } }
    title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BRAND_DARK } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(2).height = 28

    // ── ROW 3: Location ──────────────────────────────────────────────────────
    ws.mergeCells(3, 1, 3, NCOLS)
    const locRow = ws.getCell(3, 1)
    locRow.value     = `Store / Location:   ${opts.locationLabel}`
    locRow.font      = { name: 'Calibri', size: 11, color: { argb: C_TEXT_DARK } }
    locRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BRAND_LIGHT } }
    locRow.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    ws.getRow(3).height = 22

    // ── ROW 4: Date period ───────────────────────────────────────────────────
    ws.mergeCells(4, 1, 4, NCOLS)
    const periodRow = ws.getCell(4, 1)
    const periodStr = opts.dateFrom === opts.dateTo
      ? `Report Period:      ${opts.dateFrom}`
      : `Report Period:      ${opts.dateFrom}   →   ${opts.dateTo}`
    periodRow.value     = periodStr
    periodRow.font      = { name: 'Calibri', size: 11, color: { argb: C_TEXT_DARK } }
    periodRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BRAND_LIGHT } }
    periodRow.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    ws.getRow(4).height = 22

    // ── ROW 5: Generated by ──────────────────────────────────────────────────
    ws.mergeCells(5, 1, 5, NCOLS)
    const genRow = ws.getCell(5, 1)
    const nowStr = new Date().toLocaleString('en-FJ', {
      timeZone:  'Pacific/Fiji',
      day:       '2-digit',
      month:     'short',
      year:      'numeric',
      hour:      '2-digit',
      minute:    '2-digit',
    })
    genRow.value     = `Generated:          ${nowStr}   |   Prepared by: ${opts.generatedBy}`
    genRow.font      = { name: 'Calibri', size: 10, italic: true, color: { argb: C_TEXT_MUTED } }
    genRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_META_BG } }
    genRow.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    ws.getRow(5).height = 20

    // ── ROW 6: Spacer ────────────────────────────────────────────────────────
    ws.mergeCells(6, 1, 6, NCOLS)
    ws.getRow(6).height = 6

    // ── ROW 7: Column headers ────────────────────────────────────────────────
    const HDR_ROW = 7
    const hdrRow  = ws.getRow(HDR_ROW)
    sheet.columns.forEach((col, ci) => {
      const cell    = hdrRow.getCell(ci + 1)
      cell.value     = col.header
      cell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C_WHITE } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_HEADER_BG } }
      cell.alignment = { horizontal: alignFor(col), vertical: 'middle' }
      cell.border    = { bottom: { style: 'medium', color: { argb: C_BORDER_ACCENT } } }
    })
    hdrRow.height = 24

    // ── ROWS 8+: Data rows ───────────────────────────────────────────────────
    sheet.data.forEach((row, ri) => {
      const exRow = ws.getRow(HDR_ROW + 1 + ri)
      const rowBg  = ri % 2 === 0 ? C_WHITE : C_BRAND_LIGHT

      sheet.columns.forEach((col, ci) => {
        const cell    = exRow.getCell(ci + 1)
        cell.value     = cellValue(row[col.key], col.type)
        cell.numFmt    = numFmtFor(col.type)
        cell.font      = { name: 'Calibri', size: 10, color: { argb: C_TEXT_DARK } }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
        cell.alignment = { horizontal: alignFor(col), vertical: 'middle' }
        cell.border    = { bottom: { style: 'hair', color: { argb: C_BORDER } } }
      })
      exRow.height = 18
    })

    // ── Totals row ───────────────────────────────────────────────────────────
    if (sheet.totals) {
      const totRowIdx = HDR_ROW + 1 + sheet.data.length
      const totRow    = ws.getRow(totRowIdx)
      sheet.columns.forEach((col, ci) => {
        const cell = totRow.getCell(ci + 1)
        const val  = sheet.totals![col.key]
        cell.value     = val !== undefined ? cellValue(val, col.type) : ''
        cell.numFmt    = numFmtFor(col.type)
        cell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: C_TEXT_DARK } }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_TOTALS_BG } }
        cell.alignment = { horizontal: alignFor(col), vertical: 'middle' }
        cell.border    = {
          top:    { style: 'medium', color: { argb: C_BORDER_ACCENT } },
          bottom: { style: 'medium', color: { argb: C_BORDER_ACCENT } },
        }
      })
      totRow.height = 22
    }

    // ── Freeze top 7 rows (banner + meta) ────────────────────────────────────
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: HDR_ROW, topLeftCell: `A${HDR_ROW + 1}`, activeCell: 'A1' }]
  }

  // ── Write & download ─────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `${opts.filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
