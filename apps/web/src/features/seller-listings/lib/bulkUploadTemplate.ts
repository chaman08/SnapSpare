import { BULK_UPLOAD_COLUMNS, MAX_BULK_UPLOAD_ROWS } from '@snapspare/shared'
import ExcelJS from 'exceljs'

const COLUMN_DROPDOWNS: Partial<Record<(typeof BULK_UPLOAD_COLUMNS)[number]['key'], string[]>> = {
  condition: ['new', 'used', 'refurbished'],
  taxIncluded: ['TRUE', 'FALSE'],
  isOversized: ['TRUE', 'FALSE'],
}

const COLUMN_DESCRIPTIONS: Record<(typeof BULK_UPLOAD_COLUMNS)[number]['key'], string> = {
  partNumber: 'Must match a part number that already exists in the master catalogue exactly, case-insensitive.',
  sku: 'Your own SKU/code for this part. Must be unique across your listings.',
  condition: 'One of: new, used, refurbished.',
  stockQty: 'Whole number, 0 or more.',
  moq: 'Minimum order quantity a buyer must purchase. Must be a multiple of Step Qty.',
  stepQty: 'Buyers must order in multiples of this quantity above the MOQ. Defaults to 1 if left blank.',
  tier1MaxQty: 'The last quantity covered by Tier 1\'s price. Leave blank if you only want a single flat price.',
  tier1UnitPriceRupees: 'Price per unit, in rupees, for quantities from MOQ up to Tier 1 Ends At (or all quantities if single-tier).',
  tier2MaxQty: 'The last quantity covered by Tier 2\'s price. Only used if Tier 1 Ends At is set.',
  tier2UnitPriceRupees: 'Price per unit, in rupees, for Tier 2. Must be lower than Tier 1\'s price.',
  tier3UnitPriceRupees: 'Price per unit, in rupees, for every quantity above Tier 2. Must be lower than Tier 2\'s price. Leave Tier 2 blank to instead make Tier 1 the open-ended final tier.',
  mrpRupees: 'Maximum retail price shown as a strikethrough, in rupees. Optional.',
  taxIncluded: 'TRUE if your unit prices already include GST, FALSE if GST is added on top.',
  hsnCode: 'Overrides the catalogue part\'s default HSN code. Leave blank to use the catalogue default.',
  gstRatePercent: 'Overrides the catalogue part\'s default GST rate. Leave blank to use the catalogue default.',
  weightGrams: 'Shipping weight in grams. Optional but improves shipping estimate accuracy.',
  warrantyMonths: 'Warranty period in months. Optional.',
  isOversized: 'TRUE if this part needs oversized/freight shipping (bumpers, panels, batteries).',
}

const DATA_ROWS = MAX_BULK_UPLOAD_ROWS

function columnLetter(oneBasedIndex: number): string {
  let index = oneBasedIndex
  let letters = ''
  while (index > 0) {
    const remainder = (index - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    index = Math.floor((index - 1) / 26)
  }
  return letters
}

/**
 * Builds the downloadable bulk-upload workbook (requirement 4): a "Listings"
 * sheet with the exact header contract `BULK_UPLOAD_COLUMNS` and
 * `parseBulkUploadRows` (functions/src/listings/bulkUploadParsing.ts) agree
 * on, dropdown validation on enum-shaped columns so a seller can't
 * mistype "used" as "Used", and a "Data Dictionary" sheet explaining every
 * column in plain language, since the header text alone can't carry the
 * cross-field invariants (tier ordering, MOQ/step relationship).
 */
export async function buildBulkUploadTemplateWorkbook(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()

  const listSheet = workbook.addWorksheet('Listings')
  listSheet.columns = BULK_UPLOAD_COLUMNS.map((column) => ({ header: column.header, key: column.key, width: 28 }))
  listSheet.getRow(1).font = { bold: true }
  listSheet.getRow(1).alignment = { wrapText: true, vertical: 'middle' }
  listSheet.views = [{ state: 'frozen', ySplit: 1 }]

  BULK_UPLOAD_COLUMNS.forEach((column, index) => {
    const options = COLUMN_DROPDOWNS[column.key]
    if (!options) return
    const letter = columnLetter(index + 1)
    for (let row = 2; row <= DATA_ROWS + 1; row += 1) {
      listSheet.getCell(`${letter}${row}`).dataValidation = {
        type: 'list',
        allowBlank: !column.required,
        formulae: [`"${options.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: `Must be one of: ${options.join(', ')}`,
      }
    }
  })

  const dictSheet = workbook.addWorksheet('Data Dictionary')
  dictSheet.columns = [
    { header: 'Column', key: 'header', width: 40 },
    { header: 'Required', key: 'required', width: 12 },
    { header: 'Description', key: 'description', width: 90 },
  ]
  dictSheet.getRow(1).font = { bold: true }
  for (const column of BULK_UPLOAD_COLUMNS) {
    dictSheet.addRow({
      header: column.header,
      required: column.required ? 'Yes' : 'No',
      description: COLUMN_DESCRIPTIONS[column.key],
    })
  }
  dictSheet.getColumn('description').alignment = { wrapText: true, vertical: 'top' }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
