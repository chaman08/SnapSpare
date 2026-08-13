import { BULK_UPLOAD_COLUMNS, MAX_BULK_UPLOAD_ROWS, type CatalogPart, type Listing, catalogPartSchema } from '@snapspare/shared'
import ExcelJS from 'exceljs'
import type { Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { Readable } from 'node:stream'
import { mapBulkRowToListingCandidate } from './bulkRowMapper.js'
import { validateListing } from './persistListing.js'

export interface ParsedBulkRow {
  rowNumber: number
  sku?: string
  /** The fully zod-validated (defaults applied) candidate — `id`/`createdAt`/`updatedAt` are placeholders the caller must overwrite before writing. */
  listing?: Listing
  errors: string[]
}

const PLACEHOLDER_ID = 'pending'

async function loadWorkbook(buffer: Buffer, storagePath: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook()
  if (storagePath.toLowerCase().endsWith('.csv')) {
    await workbook.csv.read(Readable.from(buffer))
  } else {
    // exceljs's bundled types declare their own non-generic `Buffer`, which
    // @types/node's generic `Buffer<ArrayBufferLike>` doesn't structurally
    // satisfy even via `unknown` — identical at runtime, so `any` here just
    // sidesteps the declaration clash.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any)
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new HttpsError('invalid-argument', 'empty_workbook')
  return sheet
}

/** The zod messages listing.ts's superRefine writes are already human-readable — this just prefixes the field path for context rather than re-deriving react-i18next-style copy server-side (the error report is a downloadable technical artifact, not rendered UI). */
function describeIssues(issues: { path: (string | number)[]; message: string }[]): string[] {
  return issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
}

/**
 * Downloads and validates every row of a seller's uploaded sheet — shared by
 * `parseBulkListingUpload.ts` (dry-run, stores results for the preview
 * table) and `commitBulkListingUpload.ts` (re-parses the same file rather
 * than persisting every candidate payload inside the job doc, keeping that
 * document small — see bulkUploadJobSchema's header comment). Re-parsing is
 * deterministic: the same storage object, the same catalogue state (unless
 * an admin edited a part between parse and commit, an edge case not worth
 * optimizing away).
 */
export async function parseBulkUploadRows(db: Firestore, sellerId: string, storagePath: string): Promise<ParsedBulkRow[]> {
  const bucket = getStorage().bucket()
  const [buffer] = await bucket.file(storagePath).download()
  const sheet = await loadWorkbook(buffer, storagePath)

  const headerRow = sheet.getRow(1).values as unknown[]
  const headerToKey = new Map<string, string>()
  for (const column of BULK_UPLOAD_COLUMNS) {
    const colIndex = headerRow.findIndex((h) => typeof h === 'string' && h.trim() === column.header)
    if (colIndex > 0) headerToKey.set(column.key, String(colIndex))
  }

  const rawRows: { rowNumber: number; data: Record<string, unknown> }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    if (rawRows.length >= MAX_BULK_UPLOAD_ROWS) return
    const data: Record<string, unknown> = {}
    for (const column of BULK_UPLOAD_COLUMNS) {
      const colIndex = headerToKey.get(column.key)
      if (!colIndex) continue
      data[column.key] = row.getCell(Number(colIndex)).value
    }
    const hasAnyValue = Object.values(data).some((v) => v !== null && v !== undefined && v !== '')
    if (hasAnyValue) rawRows.push({ rowNumber, data })
  })

  const partNumbers = Array.from(
    new Set(rawRows.map((r) => (r.data.partNumber ? String(r.data.partNumber).trim() : '')).filter(Boolean)),
  )
  const catalogPartByNumber = new Map<string, CatalogPart>()
  for (let i = 0; i < partNumbers.length; i += 30) {
    const chunk = partNumbers.slice(i, i + 30)
    const snapshot = await db.collection('catalogParts').where('partNumber', 'in', chunk).get()
    for (const doc of snapshot.docs) {
      const result = catalogPartSchema.safeParse({ id: doc.id, ...doc.data() })
      if (result.success) catalogPartByNumber.set(result.data.partNumber, result.data)
    }
  }

  const now = Date.now()
  const results: ParsedBulkRow[] = []

  for (const { rowNumber, data } of rawRows) {
    const partNumber = data.partNumber ? String(data.partNumber).trim() : ''
    const sku = data.sku ? String(data.sku).trim() : undefined
    const catalogPart = partNumber ? catalogPartByNumber.get(partNumber) : undefined

    if (!partNumber) {
      results.push({ rowNumber, sku, errors: ['Missing part number'] })
      continue
    }
    if (!catalogPart) {
      results.push({ rowNumber, sku, errors: [`Part number "${partNumber}" not found in catalogue`] })
      continue
    }

    const mapping = mapBulkRowToListingCandidate(data, sellerId, catalogPart)
    if (mapping.earlyError) {
      results.push({ rowNumber, sku, errors: [mapping.earlyError] })
      continue
    }

    const validated = validateListing({ ...mapping.candidate, id: PLACEHOLDER_ID, createdAt: now, updatedAt: now })
    if (!validated.success) {
      results.push({ rowNumber, sku, errors: describeIssues(validated.issues) })
    } else {
      results.push({ rowNumber, sku, listing: validated.data, errors: [] })
    }
  }

  return results
}
