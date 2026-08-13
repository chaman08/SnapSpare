import type { GetCommissionRatePreviewRequest, GetCommissionRatePreviewResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getCommissionRatePreviewCallable = httpsCallable<GetCommissionRatePreviewRequest, GetCommissionRatePreviewResult>(
  functions,
  'getCommissionRatePreview',
)

/** Returns only {percent, source} per requested category — never the raw config/commission doc. See functions/src/pricing/getCommissionRatePreview.ts. */
export async function getCommissionRatePreview(categorySlugs: string[]): Promise<GetCommissionRatePreviewResult> {
  const result = await getCommissionRatePreviewCallable({ categorySlugs })
  return result.data
}
