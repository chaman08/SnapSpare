import { z } from 'zod'
import { sellerBusinessTypeSchema, bankAccountSchema } from './seller'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { gstinSchema, mobileSchema, panSchema, pincodeSchema } from '../validators/indian'
import { epochMsSchema, stateCodeSchema } from './common'

export const sellerApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
])
export type SellerApplicationStatus = z.infer<typeof sellerApplicationStatusSchema>

export const sellerApplicationBusinessSchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().min(1),
  businessType: sellerBusinessTypeSchema,
  yearsInBusiness: z.number().int().nonnegative(),
  categorySlugs: z.array(z.string()).min(1),
  brandsDealtIn: z.array(z.string()).default([]),
})
export type SellerApplicationBusiness = z.infer<typeof sellerApplicationBusinessSchema>

/**
 * `turnoverMode` only matters when `gstRegistered` is false: it's the
 * applicant's declared basis for trading without a GSTIN (India's
 * ecommerce-operator rules let small intra-state-only sellers below the
 * registration threshold sell without one). Approval into an active seller
 * account still requires a GSTIN in this version of the platform (see
 * reviewSellerApplication.ts) — this field only drives the onboarding
 * messaging, it's not (yet) load-bearing for any pricing/tax/shipping code.
 */
export const sellerApplicationTaxIdentitySchema = z
  .object({
    gstRegistered: z.boolean(),
    gstin: gstinSchema.optional(),
    pan: panSchema,
    gstComposition: z.boolean().default(false),
    turnoverMode: z.enum(['unregistered_below_threshold', 'unregistered_intrastate_only']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.gstRegistered && !value.gstin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: 'GSTIN is required when GST-registered' })
    }
  })
export type SellerApplicationTaxIdentity = z.infer<typeof sellerApplicationTaxIdentitySchema>

export const sellerApplicationAddressSchema = z.object({
  contactName: z.string().min(1),
  contactPhone: mobileSchema,
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  pincode: pincodeSchema,
})
export type SellerApplicationAddress = z.infer<typeof sellerApplicationAddressSchema>

export const sellerApplicationPickupAddressSchema = sellerApplicationAddressSchema.extend({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean().default(false),
  serviceable: z.boolean().optional(),
})
export type SellerApplicationPickupAddress = z.infer<typeof sellerApplicationPickupAddressSchema>

export const sellerApplicationBankSchema = bankAccountSchema.extend({
  branch: z.string().optional(),
  cancelledChequeStoragePath: z.string().optional(),
})
export type SellerApplicationBank = z.infer<typeof sellerApplicationBankSchema>

export const sellerApplicationDocumentsSchema = z.object({
  gstCertificateStoragePath: z.string().optional(),
  panStoragePath: z.string().optional(),
  addressProofStoragePath: z.string().optional(),
  brandAuthLetterStoragePaths: z.array(z.string()).default([]),
  shopPhotoStoragePath: z.string().optional(),
})
export type SellerApplicationDocuments = z.infer<typeof sellerApplicationDocumentsSchema>

export const SELLER_AGREEMENT_VERSION = '2026-01-seller-tos-v1'

export const sellerApplicationAgreementSchema = z.object({
  accepted: z.boolean(),
  version: z.string().min(1),
  acceptedAt: epochMsSchema.optional(),
  ip: z.string().optional(),
})
export type SellerApplicationAgreement = z.infer<typeof sellerApplicationAgreementSchema>

export const sellerApplicationReviewNoteSchema = z.object({
  step: z.enum(['business', 'tax_identity', 'addresses', 'bank', 'documents', 'agreement', 'general']),
  message: z.string().min(1),
  createdAt: epochMsSchema,
})
export type SellerApplicationReviewNote = z.infer<typeof sellerApplicationReviewNoteSchema>

/**
 * One draft per prospective seller, one-to-one with the owner's account:
 * `id === ownerUserId` (not a generated id) — this is what lets onboarding
 * documents upload straight to `sellers/{uid}/kyc/...`, the same Storage path
 * they'll live at post-approval, since (by the same design choice) an
 * approved seller's `sellers/{sellerId}` doc id is also its owner's uid.
 * `reviewSellerApplication.ts` is the only writer of `status`/`reviewNotes`/
 * `reviewedBy`/`reviewedAt`/`submittedAt` — see firestore.rules.
 */
export const sellerApplicationSchema = z.object({
  id: userIdSchema,
  ownerUserId: userIdSchema,
  status: sellerApplicationStatusSchema,
  currentStep: z.number().int().min(1).max(6).default(1),
  business: sellerApplicationBusinessSchema.optional(),
  taxIdentity: sellerApplicationTaxIdentitySchema.optional(),
  registeredAddress: sellerApplicationAddressSchema.optional(),
  pickupAddresses: z.array(sellerApplicationPickupAddressSchema).default([]),
  bank: sellerApplicationBankSchema.optional(),
  documents: sellerApplicationDocumentsSchema.default({}),
  agreement: sellerApplicationAgreementSchema.optional(),
  reviewNotes: z.array(sellerApplicationReviewNoteSchema).default([]),
  reviewedBy: userIdSchema.optional(),
  reviewedAt: epochMsSchema.optional(),
  submittedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SellerApplication = z.infer<typeof sellerApplicationSchema>

export const sellerApplicationConverter = makeFirestoreConverter(sellerApplicationSchema)

/**
 * Strict shape required to move draft/changes_requested -> submitted, checked
 * server-side by submitSellerApplication.ts. Every step's data must be
 * present and the agreement must be accepted — the wizard's per-step drafts
 * only validate their own step, so this is the single point that enforces
 * the application is actually complete before it reaches an admin queue.
 */
export const sellerApplicationSubmitSchema = z
  .object({
    business: sellerApplicationBusinessSchema,
    taxIdentity: sellerApplicationTaxIdentitySchema,
    registeredAddress: sellerApplicationAddressSchema,
    pickupAddresses: z.array(sellerApplicationPickupAddressSchema).min(1),
    bank: sellerApplicationBankSchema,
    documents: sellerApplicationDocumentsSchema,
    agreement: z.object({
      accepted: z.literal(true),
      version: z.string().min(1),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.taxIdentity.gstRegistered && !value.documents.gstCertificateStoragePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documents', 'gstCertificateStoragePath'],
        message: 'GST certificate is required for a GST-registered seller',
      })
    }
    if (!value.documents.panStoragePath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documents', 'panStoragePath'], message: 'PAN document is required' })
    }
    if (!value.documents.addressProofStoragePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documents', 'addressProofStoragePath'],
        message: 'Address proof is required',
      })
    }
    if (!value.documents.shopPhotoStoragePath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documents', 'shopPhotoStoragePath'], message: 'Shop photo is required' })
    }
  })
export type SellerApplicationSubmitInput = z.infer<typeof sellerApplicationSubmitSchema>
