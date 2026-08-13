import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { sellerIdSchema, sellerStaffIdSchema, userIdSchema } from '../ids'
import { mobileSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const sellerStaffRoleSchema = z.enum(['owner', 'manager', 'packer'])
export type SellerStaffRole = z.infer<typeof sellerStaffRoleSchema>

export const sellerStaffPermissionSchema = z.enum([
  'manage_listings',
  'manage_orders',
  'manage_staff',
  'view_payouts',
  'manage_returns',
])
export type SellerStaffPermission = z.infer<typeof sellerStaffPermissionSchema>

/**
 * Default (and maximum) permissions per invited role — inviteSellerStaff.ts
 * caps whatever the owner requests against this, and the seller-app staff UI
 * uses it to grey out permissions a given role can never hold. `owner` isn't
 * listed: an owner is never a `sellerStaff` row, they're identified by
 * holding the bare `{ role: 'seller', sellerId }` claim with no `staffRole`
 * (see auth/claims.ts) and implicitly has every permission.
 */
export const SELLER_STAFF_PERMISSION_MATRIX: Record<Exclude<SellerStaffRole, 'owner'>, SellerStaffPermission[]> = {
  manager: ['manage_listings', 'manage_orders', 'manage_returns', 'view_payouts'],
  packer: ['manage_orders'],
}

export const sellerStaffSchema = z.object({
  id: sellerStaffIdSchema,
  sellerId: sellerIdSchema,
  /** Absent while status is 'invited' — the invited phone number may not have a users/{uid} account yet. Set by acceptSellerStaffInvite.ts. */
  userId: userIdSchema.optional(),
  name: z.string().min(1),
  phone: mobileSchema,
  role: sellerStaffRoleSchema,
  permissions: z.array(sellerStaffPermissionSchema).default([]),
  status: z.enum(['active', 'invited', 'removed']),
  invitedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SellerStaff = z.infer<typeof sellerStaffSchema>

export const sellerStaffConverter = makeFirestoreConverter(sellerStaffSchema)
