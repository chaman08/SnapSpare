import type {
  BulkPriceChangeRequest,
  BulkPriceChangeResult,
  BulkStatusChangeRequest,
  BulkStatusChangeResult,
  BulkStockUpdateRequest,
  BulkStockUpdateResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const bulkPriceChangeCallable = httpsCallable<BulkPriceChangeRequest, BulkPriceChangeResult>(functions, 'bulkPriceChange')
const bulkStockUpdateCallable = httpsCallable<BulkStockUpdateRequest, BulkStockUpdateResult>(functions, 'bulkStockUpdate')
const bulkStatusChangeCallable = httpsCallable<BulkStatusChangeRequest, BulkStatusChangeResult>(functions, 'bulkStatusChange')

export async function bulkPriceChange(request: BulkPriceChangeRequest): Promise<BulkPriceChangeResult> {
  const result = await bulkPriceChangeCallable(request)
  return result.data
}

export async function bulkStockUpdate(request: BulkStockUpdateRequest): Promise<BulkStockUpdateResult> {
  const result = await bulkStockUpdateCallable(request)
  return result.data
}

export async function bulkStatusChange(request: BulkStatusChangeRequest): Promise<BulkStatusChangeResult> {
  const result = await bulkStatusChangeCallable(request)
  return result.data
}
