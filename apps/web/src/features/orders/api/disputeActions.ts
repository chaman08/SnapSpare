import type { AddDisputeEvidenceRequest, OpenDisputeRequest, OpenDisputeResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const openDisputeCallable = httpsCallable<OpenDisputeRequest, OpenDisputeResult>(functions, 'openDispute')
const addDisputeEvidenceCallable = httpsCallable<AddDisputeEvidenceRequest, { disputeId: string }>(
  functions,
  'addDisputeEvidence',
)

export const openDispute = (request: OpenDisputeRequest) => openDisputeCallable(request).then((r) => r.data)
export const addDisputeEvidence = (request: AddDisputeEvidenceRequest) =>
  addDisputeEvidenceCallable(request).then((r) => r.data)

export function mapDisputeErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'not_a_participant':
      return 'orders.errors.permissionDenied'
    case 'return_not_disputed':
    case 'claim_not_disputable':
      return 'orders.errors.invalidTransition'
    case 'dispute_already_open':
      return 'orders.dispute.errors.alreadyOpen'
    default:
      return 'orders.errors.generic'
  }
}
