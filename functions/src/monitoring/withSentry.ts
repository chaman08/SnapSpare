import { logger } from 'firebase-functions'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { Sentry } from './sentry.js'

/**
 * Wraps an onCall handler so an unhandled error is both reported to Sentry
 * (tagged with the function name, the caller's uid if signed in, and a
 * correlationId if the caller passed one — see order.ts's correlationId
 * field) and still re-thrown unchanged, so HttpsError codes/messages reach
 * the client exactly as before. Applied to createOrder and the Razorpay
 * webhook first (the two functions where a silent failure is costliest —
 * a lost order or a lost payment confirmation); rolling it out to every
 * other callable is mechanical repetition of this same wrap, not built here
 * — see the Phase 22 README note.
 */
export function withSentry<TData, TResult>(
  functionName: string,
  handler: (request: CallableRequest<TData>) => Promise<TResult>,
): (request: CallableRequest<TData>) => Promise<TResult> {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      const correlationId =
        typeof request.data === 'object' && request.data !== null && 'correlationId' in request.data
          ? String((request.data as { correlationId?: unknown }).correlationId)
          : undefined

      Sentry.captureException(error, {
        tags: { function: functionName, correlationId },
        user: request.auth ? { id: request.auth.uid } : undefined,
      })
      logger.error(`${functionName}: unhandled error`, {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
        uid: request.auth?.uid,
      })
      throw error
    }
  }
}
