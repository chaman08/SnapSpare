import type { DecideReturnRequest, DecideReturnResult, SubmitReturnQcRequest, SubmitReturnQcResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

/**
 * Seller/admin decision on a `requested` return and QC outcome on a
 * received one — both are Cloud-Function-only now (approve books a reverse
 * pickup; QC pass triggers a refund or replacement sub-order), replacing
 * the old direct-client `updateDoc` this file used to export (see
 * firestore.rules' `returns` collection header comment — the seller
 * direct-update path is gone).
 */
const decideReturnCallable = httpsCallable<DecideReturnRequest, DecideReturnResult>(functions, 'decideReturn')
const submitReturnQcCallable = httpsCallable<SubmitReturnQcRequest, SubmitReturnQcResult>(functions, 'submitReturnQc')

export const decideReturn = (request: DecideReturnRequest) => decideReturnCallable(request).then((r) => r.data)
export const submitReturnQc = (request: SubmitReturnQcRequest) => submitReturnQcCallable(request).then((r) => r.data)
