import {
  type BulkImportCatalogFitmentsResult,
  bulkImportCatalogFitmentsRequestSchema,
  type CatalogFitmentBulkImportRowResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { findConflictingFitments } from './fitmentConflictDetection.js'

/** Fitment workbench's bulk CSV import (design brief item 4) — same synchronous, small-batch shape as bulkImportCatalogParts.ts. */
export const bulkImportCatalogFitments = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 300 },
  async (request): Promise<BulkImportCatalogFitmentsResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = bulkImportCatalogFitmentsRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const { rows, commit } = parsed.data

    const db = getFirestore()
    const now = Date.now()
    const results: CatalogFitmentBulkImportRowResult[] = []
    let createdCount = 0

    for (const row of rows) {
      const conflictingFitmentIds = await findConflictingFitments(db, row)
      if (conflictingFitmentIds.length > 0) {
        results.push({ rowNumber: row.rowNumber, status: 'conflict', message: `Conflicts with ${conflictingFitmentIds.join(', ')}` })
        continue
      }

      if (!commit) {
        results.push({ rowNumber: row.rowNumber, status: 'ok' })
        continue
      }

      const ref = db.collection('catalogFitments').doc()
      await ref.set(
        stripUndefined({
          partId: row.partId,
          makeId: row.makeId,
          modelId: row.modelId,
          variantId: row.variantId,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
          notes: row.notes,
          createdAt: now,
          updatedAt: now,
        }),
      )
      createdCount += 1
      results.push({ rowNumber: row.rowNumber, status: 'ok', createdFitmentId: ref.id })
    }

    if (commit) {
      await writeAuditLog({
        request,
        action: 'catalogFitment.bulkImport',
        targetType: 'catalogFitments',
        targetId: `bulk-${now}`,
        after: { rowCount: rows.length, createdCount },
      })
    }

    return { rows: results, createdCount }
  },
)
