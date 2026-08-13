import {
  type CommitBulkListingUploadResult,
  type Listing,
  bulkUploadJobSchema,
  commitBulkListingUploadRequestSchema,
} from '@snapspare/shared'
import ExcelJS from 'exceljs'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { parseBulkUploadRows } from './bulkUploadParsing.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { stripUndefined } from '../util/stripUndefined.js'

const BATCH_LIMIT = 400

function stripListingId(listing: Listing): Omit<Listing, 'id'> {
  const { id: _id, ...rest } = listing
  return stripUndefined(rest) as Omit<Listing, 'id'>
}

async function buildErrorReportBuffer(rows: { rowNumber: number; sku?: string; errors: string[] }[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Errors')
  sheet.columns = [
    { header: 'Row Number', key: 'rowNumber', width: 12 },
    { header: 'SKU', key: 'sku', width: 20 },
    { header: 'Reason', key: 'reason', width: 80 },
  ]
  for (const row of rows) {
    sheet.addRow({ rowNumber: row.rowNumber, sku: row.sku ?? '', reason: row.errors.join('; ') })
  }
  sheet.getRow(1).font = { bold: true }
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * manage_listings-gated. Re-parses the job's source file (see
 * parseBulkUploadRows's header comment for why it re-parses instead of
 * reading candidates back from the job doc), writes only the rows that
 * validated successfully, and generates an error report (original row
 * number + plain-language reason) for the rest — requirement 4's
 * "commit only the valid rows" + downloadable error report.
 */
export const commitBulkListingUpload = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 120, memory: '512MiB' },
  async (request): Promise<CommitBulkListingUploadResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = commitBulkListingUploadRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid_request')

    const db = getFirestore()
    const jobRef = db.collection('bulkUploadJobs').doc(parsed.data.jobId)
    const jobSnapshot = await jobRef.get()
    if (!jobSnapshot.exists) throw new HttpsError('not-found', 'job_not_found')
    const job = bulkUploadJobSchema.parse({ id: jobSnapshot.id, ...jobSnapshot.data() })
    if (job.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_job')
    if (job.status !== 'ready_for_review') throw new HttpsError('failed-precondition', 'job_not_ready')

    await jobRef.update({ status: 'committing', updatedAt: Date.now() })

    const parsedRows = await parseBulkUploadRows(db, sellerId, job.sourceStoragePath)
    const validRows = parsedRows.filter((r) => r.listing)
    const invalidRows = parsedRows.filter((r) => !r.listing)

    const listingsRef = db.collection('listings')
    const rowToListingId = new Map<number, string>()
    const now = Date.now()

    for (let i = 0; i < validRows.length; i += BATCH_LIMIT) {
      const chunk = validRows.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()
      for (const row of chunk) {
        const listing = row.listing as Listing
        const ref = listingsRef.doc()
        batch.set(ref, stripListingId({ ...listing, id: ref.id, createdAt: now, updatedAt: now }))
        rowToListingId.set(row.rowNumber, ref.id)
      }
      await batch.commit()
    }

    let errorReportStoragePath: string | undefined
    if (invalidRows.length > 0) {
      const buffer = await buildErrorReportBuffer(invalidRows)
      errorReportStoragePath = `sellers/${sellerId}/bulkUploads/${job.id}/error-report.xlsx`
      await getStorage()
        .bucket()
        .file(errorReportStoragePath)
        .save(buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    }

    const rows = parsedRows.map((row) => {
      const listingId = rowToListingId.get(row.rowNumber)
      return {
        rowNumber: row.rowNumber,
        ...(row.sku ? { sku: row.sku } : {}),
        valid: Boolean(row.listing),
        errors: row.errors,
        ...(listingId ? { listingId } : {}),
      }
    })

    await jobRef.update(
      stripUndefined({
        status: 'committed',
        committedRows: validRows.length,
        errorReportStoragePath,
        rows,
        updatedAt: Date.now(),
      }),
    )

    return { committedRows: validRows.length, errorReportStoragePath }
  },
)
