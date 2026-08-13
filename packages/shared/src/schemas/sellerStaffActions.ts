import { z } from 'zod'
import { sellerStaffIdSchema } from '../ids'
import { mobileSchema } from '../validators/indian'
import { sellerStaffPermissionSchema, sellerStaffRoleSchema } from './sellerStaff'

export const inviteSellerStaffRequestSchema = z.object({
  name: z.string().min(1),
  phone: mobileSchema,
  role: sellerStaffRoleSchema.exclude(['owner']),
  /** Optional narrower grant than the role's default matrix — capped server-side, never widened. */
  permissions: z.array(sellerStaffPermissionSchema).optional(),
})
export type InviteSellerStaffRequest = z.infer<typeof inviteSellerStaffRequestSchema>

export const inviteSellerStaffResultSchema = z.object({
  sellerStaffId: sellerStaffIdSchema,
})
export type InviteSellerStaffResult = z.infer<typeof inviteSellerStaffResultSchema>

export const acceptSellerStaffInviteResultSchema = z.object({
  sellerId: z.string().min(1),
  role: sellerStaffRoleSchema,
})
export type AcceptSellerStaffInviteResult = z.infer<typeof acceptSellerStaffInviteResultSchema>

export const removeSellerStaffRequestSchema = z.object({
  sellerStaffId: sellerStaffIdSchema,
})
export type RemoveSellerStaffRequest = z.infer<typeof removeSellerStaffRequestSchema>
