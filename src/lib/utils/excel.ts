/**
 * Professional Excel export — Indulge POS
 *
 * Visual design:
 *   Row 1  – Blue banner (INDULGE POS SYSTEM)
 *   Row 2  – Amber/gold accent stripe
 *   Row 3  – Dark-navy title bar (report name)
 *   Row 4  – Location line  (sky bg)
 *   Row 5  – Period line    (sky bg)
 *   Row 6  – Generated-by   (near-white bg, italic)
 *   Row 7  – Spacer
 *   [optional KPI cards – 2 rows]
 *   [optional spacer after KPIs]
 *   N      – Column headers  (blue-900 bg, white bold, auto-filter)
 *   N+…    – Data rows       (alternating white / pale-blue;
 *                             status-aware: green / red / amber)
 *   Last   – Totals row      (amber-50 bg, amber border) — pops vs data
 *
 * Features:
 *   • 4-sided grid borders on every header + data cell
 *   • Thick outer border around the entire data table
 *   • Section-header rows (marked with _section: true in data)
 *   • KPI "dashboard card" tiles (optional per sheet)
 *   • Status-aware row colours (statusKey option)
 *   • Auto-filter on column headers
 *   • Frozen pane through column header row
 *   • Print-ready: landscape A4, repeat headers, print area set
 *   • Multi-sheet support
 */

import ExcelJS from 'exceljs'

// ── Palette (full ARGB – 'FF' = fully opaque) ─────────────────────────────────
const C = {
  // Header
  bannerBg:   'FF1A56DB',   // rich blue-600
  accentLine: 'FFB45309',   // amber-700 stripe
  titleBg:    'FF1E2A4A',   // very dark navy
  metaBg:     'FFF0F9FF',   // sky-50
  genBg:      'FFFAFAFA',   // near-white

  // KPI cards
  kpi1:       'FF1A56DB',   // blue-600  (odd cards)
  kpi2:       'FF1E3A8A',   // blue-900  (even cards)

  // Table header
  colHdrBg:   'FF1E3A8A',   // blue-900
  colHdrBor:  'FF3B82F6',   // blue-500  (separator between header cells)

  // Data rows
  evenRow:    'FFFFFFFF',
  oddRow:     'FFF0F7FF',   // very pale blue

  // Status-aware rows
  done:       'FFF0FDF4',   // green-50
  voided:     'FFFEF2F2',   // red-50
  refunded:   'FFFEFCE8',   // yellow-50
  partial:    'FFFEF3C7',   // amber-50

  // Section header rows (in summary reports)
  sectionBg:  'FFE0E7FF',   // indigo-100
  sectionFg:  'FF1E2A4A',   // dark navy text

  // Totals row
  totBg:      'FFFEF3C7',   // amber-50   ← completely different to data rows
  totBorder:  'FFD97706',   // amber-600  ← accent border top+bottom

  // Grid borders
  gridThin:   'FFE2E8F0',   // slate-200
  gridMid:    'FFCBD5E1',   // slate-300  (outer table border)

  // Text
  white:      'FFFFFFFF',
  dark:       'FF0F172A',   // slate-900
  muted:      'FF64748B',   // slate-500
} as const

// ── Types ─────────────────────────────────────────────────────────────────────
export type ColType  = 'text' | 'currency' | 'number' | 'integer' | 'percent' | 'date'
export type ColAlign = 'left' | 'right' | 'center'

export interface ExcelColumn {
  header: string
  key:    string
  width?: number
  type?:  ColType
  align?: ColAlign
}

export interface ExcelKPI {
  label: string
  value: string
}

export interface ExcelSheet {
  name:       string
  columns:    ExcelColumn[]
  /** Rows — use { _section: true, <firstKey>: 'Section Title' } for section headers */
  data:       Record<string, unknown>[]
  totals?:    Record<string, unknown>
  /** Key-metric tiles shown above the data table */
  kpis?:      ExcelKPI[]
  /** Column key whose value determines the status-aware row colour */
  statusKey?: string
}

export interface ExcelExportOptions {
  filename:      string
  reportTitle:   string
  locationLabel: string
  dateFrom:      string
  dateTo:        string
  generatedBy:   string
  sheets:        ExcelSheet[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function numFmt(type: ColType | undefined): string {
  if (type === 'currency' || type === 'number') return '#,##0.00'
  if (type === 'integer')  return '#,##0'
  if (type === 'percent')  return '0.0"%"'
  return '@'
}

function colAlign(col: ExcelColumn): ExcelJS.Alignment['horizontal'] {
  if (col.align) return col.align
  const numeric = col.type === 'currency' || col.type === 'number' || col.type === 'integer' || col.type === 'percent'
  return numeric ? 'right' : 'left'
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return val
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

function cellVal(val: unknown, type: ColType | undefined): ExcelJS.CellValue {
  if (type === 'currency' || type === 'number' || type === 'percent') return toNum(val)
  if (type === 'integer') return Math.round(toNum(val))
  if (val === null || val === undefined) return ''
  return String(val)
}

function statusRowBg(status: string): string {
  const s = String(status).toLowerCase()
  if (s === 'completed' || s === 'active')   return C.done
  if (s === 'voided')                         return C.voided
  if (s === 'refunded' || s === 'partial refund' || s === 'partial_refund') return C.refunded
  return ''  // empty = use default alternating colour
}

function thinBorder(argb: string): ExcelJS.Border {
  return { style: 'thin', color: { argb } }
}
function medBorder(argb: string): ExcelJS.Border {
  return { style: 'medium', color: { argb } }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function exportToExcel(opts: ExcelExportOptions): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Indulge POS'
  wb.created  = new Date()
  wb.modified = new Date()

  for (const sheet of opts.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      pageSetup: {
        orientation: 'landscape',
        fitToPage:   true,
        fitToWidth:  1,
        fitToHeight: 0,
        paperSize:   9,     // A4
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    })

    const NC = sheet.columns.length
    ws.columns = sheet.columns.map(c => ({ width: c.width ?? 16 }))

    let row = 1   // current row pointer

    // ── Banner ─────────────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    const banner = ws.getCell(row, 1)
    banner.value     = '✦  INDULGE POS SYSTEM  ✦'
    banner.font      = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } }
    banner.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bannerBg } }
    banner.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 40
    row++

    // ── Amber accent stripe ────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.accentLine } }
    ws.getRow(row).height = 4
    row++

    // ── Report title ───────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    const title = ws.getCell(row, 1)
    title.value     = opts.reportTitle.toUpperCase()
    title.font      = { name: 'Calibri', size: 14, bold: true, color: { argb: C.white } }
    title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titleBg } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    // ── Location ───────────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    const locCell = ws.getCell(row, 1)
    locCell.value     = `  📍  Store / Location:   ${opts.locationLabel}`
    locCell.font      = { name: 'Calibri', size: 11, bold: false, color: { argb: C.dark } }
    locCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.metaBg } }
    locCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(row).height = 22
    row++

    // ── Period ─────────────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    const periodCell = ws.getCell(row, 1)
    const periodStr = opts.dateFrom === opts.dateTo
      ? `  📅  Report Period:   ${opts.dateFrom}`
      : `  📅  Report Period:   ${opts.dateFrom}   →   ${opts.dateTo}`
    periodCell.value     = periodStr
    periodCell.font      = { name: 'Calibri', size: 11, color: { argb: C.dark } }
    periodCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.metaBg } }
    periodCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(row).height = 22
    row++

    // ── Generated by ───────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    const genCell = ws.getCell(row, 1)
    const nowStr = new Date().toLocaleString('en-FJ', {
      timeZone: 'Pacific/Fiji',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    genCell.value     = `  🕐  Generated: ${nowStr}   |   Prepared by: ${opts.generatedBy}`
    genCell.font      = { name: 'Calibri', size: 10, italic: true, color: { argb: C.muted } }
    genCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.genBg } }
    genCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(row).height = 20
    row++

    // ── Spacer ─────────────────────────────────────────────────────────────
    ws.mergeCells(row, 1, row, NC)
    ws.getRow(row).height = 8
    row++

    // ── KPI Cards (optional) ───────────────────────────────────────────────
    if (sheet.kpis && sheet.kpis.length > 0) {
      const kpis = sheet.kpis
      const cardW = Math.max(2, Math.floor(NC / kpis.length))
      const LABEL_ROW = row
      const VALUE_ROW = row + 1

      kpis.forEach((kpi, ki) => {
        const colStart = ki * cardW + 1
        const colEnd   = Math.min(colStart + cardW - 1, NC)
        const bg       = ki % 2 === 0 ? C.kpi1 : C.kpi2

        // Label row
        ws.mergeCells(LABEL_ROW, colStart, LABEL_ROW, colEnd)
        const labelCell = ws.getCell(LABEL_ROW, colStart)
        labelCell.value     = kpi.label.toUpperCase()
        labelCell.font      = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FFBFDBFE' } }
        labelCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (ki > 0) labelCell.border = { left: { style: 'medium', color: { argb: C.white } } }

        // Value row
        ws.mergeCells(VALUE_ROW, colStart, VALUE_ROW, colEnd)
        const valCell = ws.getCell(VALUE_ROW, colStart)
        valCell.value     = kpi.value
        valCell.font      = { name: 'Calibri', size: 14, bold: true, color: { argb: C.white } }
        valCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        valCell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (ki > 0) valCell.border = { left: { style: 'medium', color: { argb: C.white } } }
      })

      ws.getRow(LABEL_ROW).height = 18
      ws.getRow(VALUE_ROW).height = 30
      row += 2

      // Thin amber accent under KPIs
      ws.mergeCells(row, 1, row, NC)
      ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.accentLine } }
      ws.getRow(row).height = 3
      row++

      // Spacer after KPIs
      ws.mergeCells(row, 1, row, NC)
      ws.getRow(row).height = 6
      row++
    }

    // ── Column headers ─────────────────────────────────────────────────────
    const HDR_ROW = row
    const hdrRow  = ws.getRow(HDR_ROW)

    sheet.columns.forEach((col, ci) => {
      const cell  = hdrRow.getCell(ci + 1)
      const isFirst = ci === 0
      const isLast  = ci === NC - 1

      cell.value     = col.header
      cell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.colHdrBg } }
      cell.alignment = { horizontal: colAlign(col), vertical: 'middle' }
      cell.border    = {
        top:    medBorder(C.gridMid),
        bottom: medBorder(C.accentLine),
        left:   isFirst ? medBorder(C.gridMid) : thinBorder(C.colHdrBor),
        right:  isLast  ? medBorder(C.gridMid) : thinBorder(C.colHdrBor),
      }
    })
    hdrRow.height = 26

    // Auto-filter on header row
    ws.autoFilter = {
      from: { row: HDR_ROW, column: 1 },
      to:   { row: HDR_ROW, column: NC },
    }
    row++

    // ── Data rows ──────────────────────────────────────────────────────────
    const DATA_START = row

    sheet.data.forEach((dataRow, ri) => {
      const exRow   = ws.getRow(row)
      const isSection = dataRow['_section'] === true

      if (isSection) {
        // Section header row (spans full width)
        ws.mergeCells(row, 1, row, NC)
        const sc = exRow.getCell(1)
        const label = String(dataRow[sheet.columns[0]?.key ?? ''] ?? '')
        sc.value     = `  ${label}`
        sc.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: C.sectionFg } }
        sc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.sectionBg } }
        sc.alignment = { horizontal: 'left', vertical: 'middle' }
        sc.border    = {
          top:    thinBorder(C.gridThin),
          bottom: thinBorder(C.gridThin),
          left:   medBorder(C.gridMid),
          right:  medBorder(C.gridMid),
        }
        exRow.height = 20
      } else {
        // Normal data row
        const statusVal = sheet.statusKey ? String(dataRow[sheet.statusKey] ?? '') : ''
        const statusBg  = statusVal ? statusRowBg(statusVal) : ''
        const defaultBg = ri % 2 === 0 ? C.evenRow : C.oddRow
        const rowBg     = statusBg || defaultBg

        sheet.columns.forEach((col, ci) => {
          const cell    = exRow.getCell(ci + 1)
          const isFirst = ci === 0
          const isLast  = ci === NC - 1

          cell.value     = cellVal(dataRow[col.key], col.type)
          cell.numFmt    = numFmt(col.type)
          cell.font      = { name: 'Calibri', size: 10, color: { argb: C.dark } }
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          cell.alignment = { horizontal: colAlign(col), vertical: 'middle', wrapText: false }
          cell.border    = {
            top:    thinBorder(C.gridThin),
            bottom: thinBorder(C.gridThin),
            left:   isFirst ? medBorder(C.gridMid) : thinBorder(C.gridThin),
            right:  isLast  ? medBorder(C.gridMid) : thinBorder(C.gridThin),
          }
        })
        exRow.height = 19
      }
      row++
    })

    // ── Totals row ─────────────────────────────────────────────────────────
    if (sheet.totals) {
      const totRow = ws.getRow(row)
      sheet.columns.forEach((col, ci) => {
        const cell    = totRow.getCell(ci + 1)
        const val     = sheet.totals![col.key]
        const isFirst = ci === 0
        const isLast  = ci === NC - 1

        cell.value     = val !== undefined ? cellVal(val, col.type) : ''
        cell.numFmt    = numFmt(col.type)
        cell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: C.dark } }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totBg } }
        cell.alignment = { horizontal: colAlign(col), vertical: 'middle' }
        cell.border    = {
          top:    medBorder(C.totBorder),
          bottom: medBorder(C.totBorder),
          left:   isFirst ? medBorder(C.totBorder) : thinBorder(C.gridThin),
          right:  isLast  ? medBorder(C.totBorder) : thinBorder(C.gridThin),
        }
      })
      totRow.height = 24
      row++
    }

    // ── Thick outer border bottom on last data row ─────────────────────────
    if (!sheet.totals && sheet.data.length > 0) {
      const lastDataRow = ws.getRow(row - 1)
      sheet.columns.forEach((col, ci) => {
        const cell = lastDataRow.getCell(ci + 1)
        cell.border = {
          ...cell.border,
          bottom: medBorder(C.gridMid),
          left:   ci === 0      ? medBorder(C.gridMid) : thinBorder(C.gridThin),
          right:  ci === NC - 1 ? medBorder(C.gridMid) : thinBorder(C.gridThin),
        }
      })
    }

    // ── Row count footer ───────────────────────────────────────────────────
    row++
    ws.mergeCells(row, 1, row, NC)
    const footer = ws.getCell(row, 1)
    footer.value     = `  ${sheet.data.filter(r => !r['_section']).length} record${sheet.data.filter(r => !r['_section']).length !== 1 ? 's' : ''}  ·  Generated by Indulge POS`
    footer.font      = { name: 'Calibri', size: 9, italic: true, color: { argb: C.muted } }
    footer.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(row).height = 16

    // ── Print settings ─────────────────────────────────────────────────────
    ws.pageSetup.printTitlesRow = `${HDR_ROW}:${HDR_ROW}`
    ws.pageSetup.printArea      = `A1:${ws.getColumn(NC).letter}${row}`

    // ── Freeze rows through column header ──────────────────────────────────
    ws.views = [{
      state:       'frozen',
      xSplit:      0,
      ySplit:      HDR_ROW,
      topLeftCell: `A${DATA_START}`,
      activeCell:  'A1',
    }]
  }

  // ── Download ─────────────────────────────────────────────────────────────
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
