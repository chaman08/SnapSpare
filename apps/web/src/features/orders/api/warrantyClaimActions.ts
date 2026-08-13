import type {
  DecideWarrantyClaimRequest,
  DecideWarrantyClaimResult,
  SubmitWarrantyClaimRequest,
  SubmitWarrantyClaimResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const submitWarrantyClaimCallable = httpsCallable<SubmitWarrantyClaimRequest, SubmitWarrantyClaimResult>(
  functions,
  'submitWarrantyClaim',
)
const decideWarrantyClaimCallable = httpsCallable<DecideWarrantyClaimRequest, DecideWarrantyClaimResult>(
  functions,
  'decideWarrantyClaim',
)
const getWarrantyClaimEvidenceUrlsCallable = httpsCallable<{ claimId: string }, { urls: string[]; videoUrl?: string }>(
  functions,
  'getWarrantyClaimEvidenceUrls',
)

export const submitWarrantyClaim = (request: SubmitWarrantyClaimRequest) =>
  submitWarrantyClaimCallable(request).then((r) => r.data)
export const decideWarrantyClaim = (request: DecideWarrantyClaimRequest) =>
  decideWarrantyClaimCallable(request).then((r) => r.data)
export const getWarrantyClaimEvidenceUrls = (claimId: string) =>
  getWarrantyClaimEvidenceUrlsCallable({ claimId }).then((r) => r.data)

export function mapWarrantyClaimErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'not_your_order':
    case 'not_your_claim':
    case 'not_a_participant':
      return 'orders.errors.permissionDenied'
    case 'not_delivered':
      return 'orders.errors.notDelivered'
    case 'no_warranty':
      return 'orders.errors.noWarranty'
    case 'warranty_expired':
      return 'orders.errors.warrantyExpired'
    case 'claim_not_reviewable':
    case 'claim_not_resolvable':
      return 'orders.errors.invalidTransition'
    default:
      return 'orders.errors.generic'
  }
}
