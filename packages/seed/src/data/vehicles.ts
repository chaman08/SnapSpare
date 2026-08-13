import {
  type VehicleClass,
  type VehicleMake,
  vehicleMakeSchema,
  type VehicleModel,
  vehicleModelSchema,
  type VehicleVariant,
  vehicleVariantSchema,
} from '@snapspare/shared'
import { MAKES } from './makesModels.js'
import { slugify } from '../lib/slug.js'

/** One (make, model, variant) leaf the fitment generator can pick from. */
export interface FitmentTarget {
  makeId: string
  modelId: string
  variantId: string
  vehicleClass: VehicleClass
  yearFrom: number
  yearTo?: number
}

export interface GeneratedVehicles {
  makes: VehicleMake[]
  models: VehicleModel[]
  variants: VehicleVariant[]
  fitmentTargets: FitmentTarget[]
}

export function generateVehicles(): GeneratedVehicles {
  const now = Date.now()
  const makes: VehicleMake[] = []
  const models: VehicleModel[] = []
  const variants: VehicleVariant[] = []
  const fitmentTargets: FitmentTarget[] = []

  for (const make of MAKES) {
    makes.push(
      vehicleMakeSchema.parse({
        id: make.id,
        name: make.name,
        slug: make.slug,
        vehicleClass: make.vehicleClass,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

    for (const model of make.models) {
      const modelId = `${make.id}-${model.slug}`
      models.push(
        vehicleModelSchema.parse({
          id: modelId,
          makeId: make.id,
          name: model.name,
          slug: model.slug,
          vehicleClass: make.vehicleClass,
          generation: model.generation,
          yearFrom: model.yearFrom,
          yearTo: model.yearTo,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }),
      )

      for (const variant of model.variants) {
        const variantId = `${modelId}-${slugify(variant.name)}`
        variants.push(
          vehicleVariantSchema.parse({
            id: variantId,
            makeId: make.id,
            modelId,
            name: variant.name,
            slug: slugify(variant.name),
            fuelType: variant.fuelType,
            transmission: variant.transmission,
            engineCc: variant.engineCc,
            yearFrom: model.yearFrom,
            yearTo: model.yearTo,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          }),
        )

        fitmentTargets.push({
          makeId: make.id,
          modelId,
          variantId,
          vehicleClass: make.vehicleClass,
          yearFrom: model.yearFrom,
          yearTo: model.yearTo,
        })
      }
    }
  }

  return { makes, models, variants, fitmentTargets }
}
