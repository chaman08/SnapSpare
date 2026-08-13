import type { z } from 'zod'
import type { ListingPricing } from '../schemas/listing'

/**
 * Stable codes the web layer maps to i18next keys (`sellerListings.pricingErrors.*`)
 * with `params` interpolated in — kept as structured data here rather than
 * baked-in English strings, since this package has no i18n dependency and
 * every other user-facing string in the product goes through i18next. `raw`
 * carries the original zod issue message as a fallback for any code this
 * mapping doesn't recognize yet.
 */
export type TierValidationErrorCode =
  | 'firstTierMustMatchMoq'
  | 'moqMustBeMultipleOfStep'
  | 'tierMustBeOpenEnded'
  | 'onlyLastTierOpenEnded'
  | 'maxMustBeAtLeastMin'
  | 'tierMustStartAfterPrevious'
  | 'tierPriceMustBeLower'
  | 'raw'

export interface TierFieldError {
  /** Dot-joined zod path, e.g. `tiers.2.minQty` or `moq` — matches useFieldArray's `tiers.${index}.${field}` naming so the form can look an error up by field. */
  path: string
  code: TierValidationErrorCode
  params: Record<string, number>
  /** The zod schema's own message — already fairly readable, used when a caller doesn't want to i18n-map (e.g. a quick toast). */
  raw: string
}

/**
 * Re-derives a friendly `{code, params}` per zod issue by cross-referencing
 * the actual tiers array — deliberately not regexing the zod message string,
 * which is a maintenance trap (message wording in listing.ts's superRefine
 * could drift from any regex here without either side failing to compile).
 * Feed this the same `pricing` object passed to
 * `listingPricingSchema.safeParse` and its resulting `issues`.
 */
export function tierValidationIssuesToFieldErrors(
  pricing: Pick<ListingPricing, 'moq' | 'stepQty' | 'tiers'>,
  issues: z.ZodIssue[],
): TierFieldError[] {
  return issues.map((issue): TierFieldError => {
    const path = issue.path.join('.')
    const raw = issue.message

    if (issue.path[0] === 'moq') {
      return { path, code: 'moqMustBeMultipleOfStep', params: { stepQty: pricing.stepQty }, raw }
    }

    if (issue.path[0] === 'tiers' && typeof issue.path[1] === 'number') {
      const index = issue.path[1]
      const field = issue.path[2]
      const tierNumber = index + 1

      if (field === 'minQty' && index === 0) {
        return { path, code: 'firstTierMustMatchMoq', params: { moq: pricing.moq }, raw }
      }

      if (field === 'minQty' && index > 0) {
        const previous = pricing.tiers[index - 1]
        if (previous && previous.maxQty !== null) {
          return {
            path,
            code: 'tierMustStartAfterPrevious',
            params: { tierNumber, expectedMinQty: previous.maxQty + 1, previousTierNumber: tierNumber - 1, previousMaxQty: previous.maxQty },
            raw,
          }
        }
      }

      if (field === 'maxQty') {
        const isLast = index === pricing.tiers.length - 1
        const tier = pricing.tiers[index]
        if (isLast) {
          return { path, code: 'tierMustBeOpenEnded', params: { tierNumber }, raw }
        }
        if (tier && tier.maxQty === null) {
          return { path, code: 'onlyLastTierOpenEnded', params: { tierNumber }, raw }
        }
        return { path, code: 'maxMustBeAtLeastMin', params: { tierNumber }, raw }
      }

      if (field === 'unitPricePaise' && index > 0) {
        return { path, code: 'tierPriceMustBeLower', params: { tierNumber, previousTierNumber: tierNumber - 1 }, raw }
      }
    }

    return { path, code: 'raw', params: {}, raw }
  })
}
