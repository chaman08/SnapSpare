import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { pincodeMasterSchema } from '@snapspare/shared'
import { generatePincodeRows } from '../data/pincodes.js'

/**
 * One-off / re-runnable loader for the `pincodes` master collection against
 * a REAL Firebase project — the main `pnpm seed` pipeline (src/index.ts) is
 * hard-locked to the emulator because most of its seeders write fabricated
 * PII, but pincode->city/state data is public India Post reference data, so
 * this script is safe to point at production. Idempotent: re-running just
 * overwrites each pincode doc with the same values.
 *
 * Point it at a real project via GOOGLE_APPLICATION_CREDENTIALS / gcloud
 * application default credentials + GCLOUD_PROJECT, or at the emulator via
 * FIRESTORE_EMULATOR_HOST + GCLOUD_PROJECT.
 *
 * Run with: pnpm --filter @snapspare/seed seed-pincodes-prod
 */

const BATCH_SIZE = 400 // Firestore's hard limit is 500 writes per batch

async function main() {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT is required (the Firebase project id, e.g. snapspare-edcc1)')
  }

  if (getApps().length === 0) {
    initializeApp({ projectId })
  }

  const db = getFirestore()
  db.settings({ ignoreUndefinedProperties: true })

  const now = Date.now()
  const rows = generatePincodeRows().map((row) => pincodeMasterSchema.parse({ ...row, createdAt: now, updatedAt: now }))
  console.log(`Writing ${rows.length} pincode docs to project ${projectId}...`)

  const collection = db.collection('pincodes')
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    for (const { id, ...data } of chunk) {
      batch.set(collection.doc(id), data)
    }
    await batch.commit()
    console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`)
  }

  console.log('Done.')
}

main().catch((error: unknown) => {
  console.error('seedPincodesProd failed:', error)
  process.exitCode = 1
})
