import { z } from 'zod'
import { roleSchema } from '../types/role'
import { sellerIdSchema } from '../ids'
import { sellerStaffPermissionSchema, sellerStaffRoleSchema } from '../schemas/sellerStaff'

/**
 * Shape of the Firebase Auth custom claims object. `role` is the
 * authorization source of truth (not the denormalized `users/{uid}.roles`
 * Firestore field, which is display-only and client-writable). `sellerId`
 * is only present once a user's seller onboarding has been approved.
 *
 * `staffRole`/`permissions` are only present on a *staff* account (set by
 * acceptSellerStaffInvite.ts) — the owner's claim stays the bare
 * `{ role: 'seller', sellerId }` with neither field set, which is how
 * firestore.rules' hasSellerPermission() tells "owner" (implicit all
 * permissions) apart from "staff member" (must hold the specific permission).
 */
export const customClaimsSchema = z.object({
  role: roleSchema,
  sellerId: sellerIdSchema.optional(),
  staffRole: sellerStaffRoleSchema.optional(),
  permissions: z.array(sellerStaffPermissionSchema).optional(),
})
export type CustomClaims = z.infer<typeof customClaimsSchema>
