import {
  type BulkImportCatalogPartsResult,
  bulkImportCatalogPartsRequestSchema,
  type CatalogPartBulkImportRowResult,
  slugify,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { findDuplicateCatalogParts } from './duplicateDetection.js'

/**
 * Catalogue module's bulk CSV import (design brief item 3) — deliberately
 * synchronous over a client-parsed row array (max 500), not the
 * Storage-upload + `bulkUploadJobs` async pattern seller bulk-listing
 * upload uses (that pattern exists for seller-scale catalogues; this is a
 * lower-volume catalogue-team tool). `commit: false` only validates and
 * flags OEM duplicates; `commit: true` creates every row that isn't a
 * duplicate, skipping (never overwriting) duplicates — re-run with
 * per-row overrides if a flagged row is intentional.
 */
export const bulkImportCatalogParts = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 300 },
  async (request): Promise<BulkImportCatalogPartsResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = bulkImportCatalogPartsRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const { rows, commit } = parsed.data

    const db = getFirestore()
    const now = Date.now()
    const results: CatalogPartBulkImportRowResult[] = []
    let createdCount = 0

    // Sequential, not Promise.all: each row's duplicate check must see
    // parts created by earlier rows in this same batch (two rows in one
    // CSV sharing an OEM number should also flag each other).
    for (const row of rows) {
      const duplicateOfPartIds = row.oemNumbers.length > 0 ? await findDuplicateCatalogParts(db, row.oemNumbers) : []

      if (duplicateOfPartIds.length > 0) {
        results.push({ rowNumber: row.rowNumber, status: 'duplicate', duplicateOfPartIds })
        continue
      }

      if (!commit) {
        results.push({ rowNumber: row.rowNumber, status: 'ok', duplicateOfPartIds: [] })
        continue
      }

      const ref = db.collection('catalogParts').doc()
      await ref.set(stripUndefined({
        partNumber: row.partNumber,
        partType: 'aftermarket' as const,
        categorySlug: row.categorySlug,
        subcategorySlug: row.subcategorySlug,
        name: row.name,
        slug: slugify(row.name),
        brand: row.brand,
        oemNumbers: row.oemNumbers,
        crossRefNumbers: [],
        hsnCode: row.hsnCode,
        gstRatePercent: row.gstRatePercent,
        attributes: {},
        images: [],
        fitmentSummary: { modelIds: [] },
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }))
      createdCount += 1
      results.push({ rowNumber: row.rowNumber, status: 'ok', duplicateOfPartIds: [], createdPartId: ref.id })
    }

    if (commit) {
      await writeAuditLog({
        request,
        action: 'catalogPart.bulkImport',
        targetType: 'catalogParts',
        targetId: `bulk-${now}`,
        after: { rowCount: rows.length, createdCount },
      })
    }

    return { rows: results, createdCount }
  },
)
