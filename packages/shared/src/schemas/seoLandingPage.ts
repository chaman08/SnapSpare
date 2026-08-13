import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { partIdSchema, seoLandingPageIdSchema, vehicleMakeIdSchema, vehicleModelIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const seoFaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})
export type SeoFaqItem = z.infer<typeof seoFaqItemSchema>

/**
 * Auto-generated long-tail landing-page content (Phase 22, requirement 1 —
 * "brake pads for Maruti Swift 2018 diesel"). One doc per
 * (subcategory × vehicle model) combination that has real inventory behind
 * it. Rendered by the existing vehicle-scoped CategoryPage
 * (/parts/:categorySlug/:subCategorySlug/:vehicleSlug) when a doc exists for
 * that URL; the page still renders generically (and stays crawlable) when it
 * doesn't — this doc only upgrades the copy/JSON-LD/FAQ, it's never a gate on
 * whether the URL works. Written exclusively by
 * functions/src/marketing/generateSeoLandingPages.ts — see that file for the
 * quality bar (minimum matching parts) and the deliberate combo cap.
 */
export const seoLandingPageSchema = z.object({
  id: seoLandingPageIdSchema,
  categorySlug: z.string().min(1),
  categoryName: z.string().min(1),
  subcategorySlug: z.string().min(1).optional(),
  subcategoryName: z.string().min(1).optional(),
  vehicleMakeId: vehicleMakeIdSchema,
  vehicleModelId: vehicleModelIdSchema,
  /** The exact URL segment this doc answers for — `${make.slug}-${model.slug}`, matching useResolveVehicleFromSlug's expected shape. */
  vehicleSlug: z.string().min(1),
  makeName: z.string().min(1),
  modelName: z.string().min(1),
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
  title: z.string().min(1),
  metaDescription: z.string().min(1).max(320),
  h1: z.string().min(1),
  introText: z.string().min(1),
  faq: z.array(seoFaqItemSchema).default([]),
  /** Capped sample of matching active catalogParts, for JSON-LD ItemList + "most bought" seeding — the live grid still queries search, this is metadata only. */
  matchedPartIds: z.array(partIdSchema).default([]),
  matchedPartCount: z.number().int().nonnegative(),
  generatedAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SeoLandingPage = z.infer<typeof seoLandingPageSchema>

export const seoLandingPageConverter = makeFirestoreConverter(seoLandingPageSchema)
