import { v1 } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

/**
 * Phase 23: scheduled Firestore export (managed export, i.e. the same
 * mechanism as `gcloud firestore export` / the Console's "Import/Export"
 * page — NOT a document-by-document read, so it doesn't count against
 * Firestore read quotas or this function's own memory/time budget the way a
 * `db.collection(...).get()` sweep would).
 *
 * Exports every collection (`collectionIds: []` means "all") to
 * `gs://{projectId}-firestore-backups/scheduled/<ISO timestamp>/` once a
 * week. That bucket is deliberately separate from the default Storage
 * bucket used everywhere else in functions/src (via `getStorage().bucket()`
 * for invoices/KYC docs/return evidence/etc.) — backups want their own
 * lifecycle/retention policy and access-control boundary, not to share one
 * with app-serving content buckets.
 *
 * Nothing creates `gs://{projectId}-firestore-backups` automatically — a
 * human operator must create it once per environment (`gsutil mb` or the
 * Console) before this function's first run will succeed; see
 * docs/runbooks/firestore-restore-drill.md. The service account this
 * function runs as (the project's default App Engine / Compute service
 * account, unless overridden) also needs the
 * `roles/datastore.importExportAdmin` IAM role and write access to that
 * bucket (`roles/storage.objectAdmin` scoped to it is enough).
 *
 * To actually restore from one of these exports, see
 * docs/runbooks/firestore-restore-drill.md.
 */
export const scheduledFirestoreBackup = onSchedule(
  { region: 'asia-south1', schedule: 'every sunday 04:00', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '256MiB' },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
    if (!projectId) {
      logger.error('scheduledFirestoreBackup: no project id in the environment (GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT) — cannot export')
      return
    }

    const client = new v1.FirestoreAdminClient()
    const databaseName = client.databasePath(projectId, '(default)')
    const bucket = `gs://${projectId}-firestore-backups`
    const outputUriPrefix = `${bucket}/scheduled/${new Date().toISOString()}`

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        // Empty = every collection in the database.
        collectionIds: [],
        outputUriPrefix,
      })
      logger.info('scheduledFirestoreBackup: export started', {
        projectId,
        outputUriPrefix,
        operationName: operation.name,
      })
    } catch (error) {
      logger.error('scheduledFirestoreBackup: exportDocuments failed', {
        projectId,
        outputUriPrefix,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
)
