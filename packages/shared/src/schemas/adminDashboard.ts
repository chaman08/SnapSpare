import { z } from 'zod'
import { epochMsSchema } from './common'

export const adminDashboardMetricsRequestSchema = z.object({
  /** Trailing window length; the comparison period is the same length immediately before it. */
  periodDays: z.number().int().positive().max(365).default(30),
})
export type AdminDashboardMetricsRequest = z.infer<typeof adminDashboardMetricsRequestSchema>

const periodValueSchema = z.object({
  current: z.number().nonnegative(),
  previous: z.number().nonnegative(),
  /** (current - previous) / previous * 100, null when previous is 0 (division undefined, not "0% change"). */
  changePercent: z.number().nullable(),
})

export const adminDashboardMetricsSchema = z.object({
  period: z.object({ fromMs: epochMsSchema, toMs: epochMsSchema, days: z.number().int().positive() }),
  gmvPaise: periodValueSchema,
  orderCount: periodValueSchema,
  aovPaise: periodValueSchema,
  /** Blended commission-to-GMV ratio, computed from delivered subOrders created in each period (commissionPaise is only set at delivery — see subOrder.ts). */
  takeRatePercent: periodValueSchema,
  newBuyers: periodValueSchema,
  newSellers: periodValueSchema,
  /** Share of in-period orders placed by a buyer who placed more than one order within the same period — a period-scoped proxy for repeat purchasing, not a lifetime cohort metric (which would need a precomputed rollup to stay cheap). */
  repeatRatePercent: periodValueSchema,
  /** Non-COD orders only: paid / (paid + failed). COD has no gateway attempt to succeed or fail. */
  paymentSuccessRatePercent: periodValueSchema,
  alerts: z.object({
    slaBreachesOpen: z.number().int().nonnegative(),
    failedPayouts: z.number().int().nonnegative(),
    stuckPayments: z.number().int().nonnegative(),
    spuriousReportsOpen: z.number().int().nonnegative(),
  }),
})
export type AdminDashboardMetrics = z.infer<typeof adminDashboardMetricsSchema>
