import type {
  SaveListingRequest,
  SaveListingResult,
  UpdateListingStatusRequest,
  UpdateListingStatusResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const saveListingCallable = httpsCallable<SaveListingRequest, SaveListingResult>(functions, 'saveListing')

/** Create (no `id`) or update (`id` present) a listing. Server re-validates the full tier ladder — see functions/src/listings/persistListing.ts. */
export async function saveListing(request: SaveListingRequest): Promise<SaveListingResult> {
  const result = await saveListingCallable(request)
  return result.data
}

const updateListingStatusCallable = httpsCallable<UpdateListingStatusRequest, UpdateListingStatusResult>(
  functions,
  'updateListingStatus',
)

/** draft/active/paused/archived only — `out_of_stock` is system-set, `rejected` is admin-only. */
export async function updateListingStatus(request: UpdateListingStatusRequest): Promise<UpdateListingStatusResult> {
  const result = await updateListingStatusCallable(request)
  return result.data
}
