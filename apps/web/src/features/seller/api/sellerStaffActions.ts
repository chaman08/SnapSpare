import type {
  AcceptSellerStaffInviteResult,
  InviteSellerStaffRequest,
  InviteSellerStaffResult,
  RemoveSellerStaffRequest,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const inviteSellerStaffCallable = httpsCallable<InviteSellerStaffRequest, InviteSellerStaffResult>(
  functions,
  'inviteSellerStaff',
)
export async function inviteSellerStaff(request: InviteSellerStaffRequest): Promise<InviteSellerStaffResult> {
  const result = await inviteSellerStaffCallable(request)
  return result.data
}

const acceptSellerStaffInviteCallable = httpsCallable<void, AcceptSellerStaffInviteResult>(
  functions,
  'acceptSellerStaffInvite',
)
export async function acceptSellerStaffInvite(): Promise<AcceptSellerStaffInviteResult> {
  const result = await acceptSellerStaffInviteCallable()
  return result.data
}

const removeSellerStaffCallable = httpsCallable<RemoveSellerStaffRequest, { ok: true }>(functions, 'removeSellerStaff')
export async function removeSellerStaff(request: RemoveSellerStaffRequest): Promise<void> {
  await removeSellerStaffCallable(request)
}
