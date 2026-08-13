import { type CatalogFitment, catalogFitmentSchema, type CatalogPart } from '@snapspare/shared'
import { pickMany, randomInt, weightedBool } from '../lib/random.js'
import { FOUR_PLUS_WHEELER_ONLY_SUBCATEGORY_SLUGS, TWO_WHEELER_ONLY_SUBCATEGORY_SLUGS } from './brands.js'
import type { FitmentTarget } from './vehicles.js'

function allowedTargets(part: CatalogPart, targets: FitmentTarget[]): FitmentTarget[] {
  const subSlug = part.subcategorySlug ?? ''
  if (TWO_WHEELER_ONLY_SUBCATEGORY_SLUGS.has(subSlug)) {
    return targets.filter((target) => target.vehicleClass === 'two_wheeler')
  }
  if (FOUR_PLUS_WHEELER_ONLY_SUBCATEGORY_SLUGS.has(subSlug)) {
    return targets.filter(
      (target) => target.vehicleClass !== 'two_wheeler' && target.vehicleClass !== 'three_wheeler',
    )
  }
  return targets
}

/** Links every catalog part to 2-6 real (make, model, variant) targets, with a year range narrowed from the model's own range about 70% of the time. */
export function generateCatalogFitments(
  rng: () => number,
  parts: CatalogPart[],
  targets: FitmentTarget[],
): CatalogFitment[] {
  const now = Date.now()
  const currentYear = new Date().getFullYear()
  const fitments: CatalogFitment[] = []
  let sequence = 1

  for (const part of parts) {
    const candidates = allowedTargets(part, targets)
    if (candidates.length === 0) continue

    const pickCount = Math.min(candidates.length, randomInt(rng, 2, 6))
    const chosen = pickMany(rng, candidates, pickCount)

    for (const target of chosen) {
      const narrowYearRange = weightedBool(rng, 0.7)
      const modelYearTo = target.yearTo ?? currentYear
      const yearFrom = narrowYearRange
        ? target.yearFrom + randomInt(rng, 0, Math.max(0, Math.min(2, modelYearTo - target.yearFrom)))
        : undefined
      const yearTo = narrowYearRange ? target.yearTo : undefined

      fitments.push(
        catalogFitmentSchema.parse({
          id: `fitment-${sequence}`,
          partId: part.id,
          makeId: target.makeId,
          modelId: target.modelId,
          variantId: target.variantId,
          yearFrom,
          yearTo,
          createdAt: now,
          updatedAt: now,
        }),
      )
      sequence += 1
    }
  }

  return fitments
}
