import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { orderIdSchema, sellerIdSchema, slaBreachIdSchema, subOrderIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * One record per subOrder auto-cancelled by autoCancelUnacceptedSubOrders for
 * missing the seller's accept-by SLA — the seller performance/scorecard data
 * source. Admin/Cloud-Function-only, same closed pattern as payouts/ledgers.
 */
export const slaBreachSchema = z.object({
  id: slaBreachIdSchema,
  sellerId: sellerIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  acceptByAt: epochMsSchema,
  breachedAt: epochMsSchema,
  createdAt: epochMsSchema,
})
export type SlaBreach = z.infer<typeof slaBreachSchema>

export const slaBreachConverter = makeFirestoreConverter(slaBreachSchema)
