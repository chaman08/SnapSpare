import { type BulkUploadRowResult, type ParseBulkListingUploadResult, parseBulkListingUploadRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { parseBulkUploadRows } from './bulkUploadParsing.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'

/**
 * manage_listings-gated. Downloads the seller's uploaded sheet, validates
 * every row through the exact same `validateListing` core `saveListing`
 * uses (dry-run — nothing is written to `listings` yet), and stores the
 * per-row outcome on a `bulkUploadJobs` doc for the client's
 * preview-before-commit table. `commitBulkListingUpload.ts` is the only
 * function that actually writes listings, re-parsing this same source file.
 */
export const parseBulkListingUpload = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 120, memory: '512MiB' },
  async (request): Promise<ParseBulkListingUploadResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = parseBulkListingUploadRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid_request')
    const { storagePath } = parsed.data

    if (!storagePath.startsWith(`sellers/${sellerId}/bulkUploads/`)) {
      throw new HttpsError('permission-denied', 'not_your_upload')
    }

    const db = getFirestore()
    const parsedRows = await parseBulkUploadRows(db, sellerId, storagePath)

    const rowResults: BulkUploadRowResult[] = parsedRows.map((row) => ({
      rowNumber: row.rowNumber,
      ...(row.sku ? { sku: row.sku } : {}),
      valid: row.errors.length === 0,
      errors: row.errors,
    }))
    const validRows = rowResults.filter((r) => r.valid).length
    const invalidRows = rowResults.length - validRows

    const now = Date.now()
    const jobRef = db.collection('bulkUploadJobs').doc()
    await jobRef.set({
      sellerId,
      status: 'ready_for_review',
      sourceStoragePath: storagePath,
      totalRows: rowResults.length,
      validRows,
      invalidRows,
      committedRows: 0,
      rows: rowResults,
      createdAt: now,
      updatedAt: now,
    })

    return { jobId: jobRef.id, totalRows: rowResults.length, validRows, invalidRows }
  },
)
