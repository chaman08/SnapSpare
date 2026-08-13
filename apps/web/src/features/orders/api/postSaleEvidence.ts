import { ref, uploadBytes } from 'firebase/storage'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { storage } from '@/lib/firebase'

/**
 * Evidence photos/video for returns, seller QC, and warranty claims are all
 * private (see storage.rules' `users/{uid}/{returns,returnsQc,warrantyClaims,disputes}/**`
 * blocks) — this returns the Storage path, not a download URL, same
 * convention as uploadSpuriousReportEvidence.ts. The uploading party (buyer
 * or seller) can always read their own path back directly; a counterparty
 * views it through the matching signed-URL callable
 * (getReturnEvidenceUrls/getWarrantyClaimEvidenceUrls).
 */
export async function uploadPostSaleEvidence(
  uid: string,
  kind: 'returns' | 'returnsQc' | 'warrantyClaims' | 'disputes',
  file: File,
): Promise<string> {
  const compressed = await compressImageIfNeeded(file)
  const path = `users/${uid}/${kind}/${Date.now()}-${compressed.name}`
  await uploadBytes(ref(storage, path), compressed)
  return path
}
