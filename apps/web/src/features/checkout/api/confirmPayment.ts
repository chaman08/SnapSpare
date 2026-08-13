import type { ConfirmPaymentRequest, ConfirmPaymentResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const confirmPaymentCallable = httpsCallable<ConfirmPaymentRequest, ConfirmPaymentResult>(functions, 'confirmPayment')

/** Optimistic fast-path confirmation right after Razorpay reports success client-side — the order may already be 'confirmed' by the time this resolves if the webhook won the race, which is fine (see functions/src/checkout/paymentTransition.ts). */
export async function confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResult> {
  const result = await confirmPaymentCallable(request)
  return result.data
}
