import { pincodeMasterSchema } from '@snapspare/shared'
import { generatePincodeRows } from '../data/pincodes.js'
import { seedCollection } from '../lib/batch.js'
import { db } from '../lib/firebaseAdmin.js'

export async function seedPincodes(): Promise<void> {
  const now = Date.now()
  const rows = generatePincodeRows().map((row) =>
    pincodeMasterSchema.parse({ ...row, createdAt: now, updatedAt: now }),
  )
  await seedCollection(db.collection('pincodes'), rows)
  console.log(`  pincodes: ${rows.length}`)
}
