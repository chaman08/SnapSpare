import type { BulkOrderPadRowInput, ResolveBulkOrderResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const resolveBulkOrderCallable = httpsCallable<{ rows: BulkOrderPadRowInput[] }, ResolveBulkOrderResult>(
  functions,
  'resolveBulkOrder',
)

export async function resolveBulkOrder(rows: BulkOrderPadRowInput[]): Promise<ResolveBulkOrderResult> {
  const result = await resolveBulkOrderCallable({ rows })
  return result.data
}
