import type { ReportSpuriousPartRequest, RespondToSpuriousReportRequest } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes } from 'firebase/storage'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { functions, storage } from '@/lib/firebase'

/** Evidence photos are private (see storage.rules) — returns the Storage path, not a download URL, matching sellerOnboarding's uploadSellerDocument.ts convention; the seller/admin view them via getSpuriousReportEvidenceUrls' signed URLs. */
export async function uploadSpuriousReportEvidence(buyerId: string, file: File): Promise<string> {
  const compressed = await compressImageIfNeeded(file)
  const path = `users/${buyerId}/spuriousReports/${Date.now()}-${compressed.name}`
  await uploadBytes(ref(storage, path), compressed)
  return path
}

const reportSpuriousPartCallable = httpsCallable<ReportSpuriousPartRequest, { id: string }>(functions, 'reportSpuriousPart')
const respondToSpuriousReportCallable = httpsCallable<RespondToSpuriousReportRequest, { ok: true }>(
  functions,
  'respondToSpuriousReport',
)
const getSpuriousReportEvidenceUrlsCallable = httpsCallable<{ id: string }, { urls: string[] }>(
  functions,
  'getSpuriousReportEvidenceUrls',
)

export const reportSpuriousPart = (request: ReportSpuriousPartRequest) =>
  reportSpuriousPartCallable(request).then((r) => r.data)
export const respondToSpuriousReport = (request: RespondToSpuriousReportRequest) =>
  respondToSpuriousReportCallable(request).then((r) => r.data)
export const getSpuriousReportEvidenceUrls = (id: string) =>
  getSpuriousReportEvidenceUrlsCallable({ id }).then((r) => r.data.urls)

export function mapSpuriousReportErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'not_your_report':
    case 'not_a_participant':
      return 'trust.errors.permissionDenied'
    case 'response_already_submitted':
      return 'trust.errors.responseAlreadySubmitted'
    case 'report_already_resolved':
      return 'trust.errors.reportAlreadyResolved'
    case 'report_not_found':
      return 'trust.errors.notFound'
    default:
      return 'trust.errors.generic'
  }
}
