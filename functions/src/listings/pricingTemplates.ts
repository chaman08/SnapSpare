import {
  type ApplyPricingTemplateResult,
  type SavePricingTemplateResult,
  applyPricingTemplateRequestSchema,
  deletePricingTemplateRequestSchema,
  listingPricingSchema,
  pricingTemplateSchema,
  savePricingTemplateRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { applyPricingPatch } from './persistListing.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { stripUndefined } from '../util/stripUndefined.js'

const BATCH_LIMIT = 400

/** Same deep-validation posture as persistListing.ts: a template's default ladder gets listingPricingSchema's full superRefine; its optional group overrides get the same check per buyer type (mirrors persistListing.ts's validateGroupPricing, kept separate since neither side depends on a Listing). */
function validateTemplatePricing(pricing: unknown, groupPricing: Record<string, unknown> | undefined): void {
  const parsed = listingPricingSchema.safeParse(pricing)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_pricing', {
      issues: parsed.error.issues,
    })
  }
  if (!groupPricing) return
  for (const [buyerType, tiers] of Object.entries(groupPricing)) {
    const groupParsed = listingPricingSchema.safeParse({ moq: parsed.data.moq, stepQty: parsed.data.stepQty, tiers })
    if (!groupParsed.success) {
      throw new HttpsError(
        'invalid-argument',
        `groupPricing.${buyerType}: ${groupParsed.error.issues[0]?.message ?? 'invalid'}`,
        { buyerType, issues: groupParsed.error.issues },
      )
    }
  }
}

/** manage_listings-gated create/update of a saved ladder "shape" (requirement 3d). `request.data.id` absent means create. */
export const savePricingTemplate = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SavePricingTemplateResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = savePricingTemplateRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    }
    const input = parsed.data
    validateTemplatePricing(input.pricing, input.groupPricing)

    const db = getFirestore()
    const now = Date.now()
    const ref = input.id ? db.collection('pricingTemplates').doc(input.id) : db.collection('pricingTemplates').doc()

    let createdAt = now
    if (input.id) {
      const existing = await ref.get()
      if (!existing.exists) throw new HttpsError('not-found', 'template_not_found')
      if (existing.data()?.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_template')
      createdAt = (existing.data()?.createdAt as number | undefined) ?? now
    }

    const template = pricingTemplateSchema.parse({
      ...input,
      id: ref.id,
      sellerId,
      createdAt,
      updatedAt: now,
    })
    const { id: _id, ...data } = template
    await ref.set(stripUndefined(data))

    return { id: ref.id }
  },
)

/** manage_listings-gated. Deleting a template never touches listings that were previously created from it — it's just a saved shape, not a live link. */
export const deletePricingTemplate = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<void> => {
  const sellerId = requireSellerPermission(request, 'manage_listings')

  const parsed = deletePricingTemplateRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid_request')

  const db = getFirestore()
  const ref = db.collection('pricingTemplates').doc(parsed.data.id)
  const snapshot = await ref.get()
  if (!snapshot.exists) return
  if (snapshot.data()?.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_template')

  await ref.delete()
})

/**
 * Applies a saved template's ladder (and group overrides, if defined) onto
 * many listings at once, batched in chunks of BATCH_LIMIT like
 * setHolidayMode.ts. Each target is independently re-validated via
 * `applyPricingPatch` — one listing failing (e.g. it belongs to a
 * different seller, or was deleted mid-request) doesn't block the rest;
 * failures are collected and reported back rather than thrown.
 */
export const applyPricingTemplate = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ApplyPricingTemplateResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = applyPricingTemplateRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    }
    const { templateId, listingIds } = parsed.data

    const db = getFirestore()
    const templateSnapshot = await db.collection('pricingTemplates').doc(templateId).get()
    if (!templateSnapshot.exists) throw new HttpsError('not-found', 'template_not_found')
    const template = pricingTemplateSchema.parse({ id: templateSnapshot.id, ...templateSnapshot.data() })
    if (template.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_template')

    const appliedListingIds: string[] = []
    const failedListingIds: string[] = []

    for (let i = 0; i < listingIds.length; i += BATCH_LIMIT) {
      const chunk = listingIds.slice(i, i + BATCH_LIMIT)
      const results = await Promise.allSettled(
        chunk.map((listingId) =>
          applyPricingPatch({ sellerId, listingId, pricing: template.pricing, groupPricing: template.groupPricing }),
        ),
      )
      results.forEach((result, index) => {
        const listingId = chunk[index] as string
        if (result.status === 'fulfilled') {
          appliedListingIds.push(listingId)
        } else {
          failedListingIds.push(listingId)
          logger.warn('applyPricingTemplate: failed for listing', { listingId, error: String(result.reason) })
        }
      })
    }

    return { appliedListingIds, failedListingIds }
  },
)
