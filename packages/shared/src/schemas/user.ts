import { z } from 'zod'
import { buyerTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { addressIdSchema, userIdSchema } from '../ids'
import { roleSchema } from '../types/role'
import { gstinSchema, mobileSchema, panSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const userSchema = z.object({
  id: userIdSchema,
  // Optional: phone OTP is the primary sign-in method, but Google sign-in
  // (secondary) can create a user with no phone number at all.
  phone: mobileSchema.optional(),
  displayName: z.string().min(1),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  roles: z.array(roleSchema).min(1),
  primaryRole: roleSchema,
  buyerType: buyerTypeSchema.optional(),
  gstin: gstinSchema.optional(),
  pan: panSchema.optional(),
  /** Display-only preference for business buyers: whether product prices are shown GST-inclusive or exclusive. Never affects server-computed payable totals — checkout always shows both. Absent defaults to 'exclusive' in the UI. */
  gstDisplayMode: z.enum(['inclusive', 'exclusive']).optional(),
  fcmTokens: z.array(z.string()).default([]),
  preferredLanguage: z.enum(['en', 'hi']).default('en'),
  status: z.enum(['active', 'suspended', 'deleted']),
  defaultAddressId: addressIdSchema.optional(),
  /** Set by admin action only (never client-writable — see firestore.rules' unchangedProtectedUserFields), or automatically by processRtoRefund.ts once rtoCount crosses config/returns.rtoAutoCodBlockThreshold. While set, checkout never offers Cash on Delivery to this buyer regardless of order value or seller support. */
  codAbuseFlag: z.boolean().default(false),
  /** Incremented by processRtoRefund.ts every time a sub-order for this buyer comes back RTO (undelivered after repeated attempts) — feeds the codAbuseFlag auto-block. */
  rtoCount: z.number().int().nonnegative().default(0),
  /** Set by functions/src/orders/flagReturnAbuseBuyers.ts (scheduled, daily) when this buyer's trailing-window return rate crosses config/returns.returnRateAbuseThresholdPercent. Admin-visible only — surfaced on the admin buyer/return views, not enforced automatically against any gate today. */
  returnAbuseFlag: z.boolean().default(false),
  /** Last-computed trailing-window return rate (0-100) backing returnAbuseFlag, for admin display. */
  returnRatePercent: z.number().nonnegative().optional(),
  /** Set automatically by functions/src/abuse/orderVelocity.ts when this buyer places an unusually high number of orders within a short trailing window — admin-visible signal only, never enforced automatically against any gate (same convention as returnAbuseFlag). */
  orderVelocityFlag: z.boolean().default(false),
  /** SHA-256 hash of a handful of stable browser signals, registered by registerDeviceFingerprint.ts on sign-in — not itself PII, just an abuse-detection join key. */
  deviceFingerprint: z.string().optional(),
  /** Set automatically when this account's deviceFingerprint is shared by an unusual number of other accounts (functions/src/abuse/registerDeviceFingerprint.ts) — admin-visible signal only, same convention as returnAbuseFlag/orderVelocityFlag. */
  duplicateAccountFlag: z.boolean().default(false),
  /** Set by admin action only (approveCreditLimit.ts's precondition, never by the buyer) once a garage buyerType is verified — the eligibility gate for requesting a Khata credit line (design brief item 7). Absent/unset means not eligible regardless of buyerType. */
  garageVerifiedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type User = z.infer<typeof userSchema>

export const userConverter = makeFirestoreConverter(userSchema)
