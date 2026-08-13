import { initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

// This script writes thousands of documents with fabricated PII (phone
// numbers, GSTINs, bank accounts) and deletes nothing before doing so — it
// must never be able to touch a real project by accident.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set. This seed script only ever runs ' +
      'against the Firestore/Auth emulators — use `pnpm seed` from the repo ' +
      'root (it wraps this in `firebase emulators:exec`). Refusing to run ' +
      'against a real Firebase project.',
  )
}

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-snapspare'

initializeApp({ projectId })

export const db: Firestore = getFirestore()
// Several schemas have optional fields (vehicleModel.generation,
// listing.mrpPaise, etc.) that zod's .parse() leaves present-but-undefined
// rather than absent when the input explicitly supplied `undefined` — the
// Admin SDK otherwise rejects those as invalid document data.
db.settings({ ignoreUndefinedProperties: true })
export const authAdmin: Auth = getAuth()
