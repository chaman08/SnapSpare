import type {
  ApplyPricingTemplateRequest,
  ApplyPricingTemplateResult,
  DeletePricingTemplateRequest,
  SavePricingTemplateRequest,
  SavePricingTemplateResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const savePricingTemplateCallable = httpsCallable<SavePricingTemplateRequest, SavePricingTemplateResult>(
  functions,
  'savePricingTemplate',
)
const deletePricingTemplateCallable = httpsCallable<DeletePricingTemplateRequest, void>(functions, 'deletePricingTemplate')
const applyPricingTemplateCallable = httpsCallable<ApplyPricingTemplateRequest, ApplyPricingTemplateResult>(
  functions,
  'applyPricingTemplate',
)

export async function savePricingTemplate(request: SavePricingTemplateRequest): Promise<SavePricingTemplateResult> {
  const result = await savePricingTemplateCallable(request)
  return result.data
}

export async function deletePricingTemplate(id: string): Promise<void> {
  await deletePricingTemplateCallable({ id })
}

export async function applyPricingTemplate(templateId: string, listingIds: string[]): Promise<ApplyPricingTemplateResult> {
  const result = await applyPricingTemplateCallable({ templateId, listingIds })
  return result.data
}
