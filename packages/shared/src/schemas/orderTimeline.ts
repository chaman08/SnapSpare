import { z } from 'zod'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const timelineActorTypeSchema = z.enum(['buyer', 'seller', 'admin', 'system'])
export type TimelineActorType = z.infer<typeof timelineActorTypeSchema>

export const timelineActorSchema = z.object({
  type: timelineActorTypeSchema,
  /** Absent for type: 'system' (scheduled functions / webhooks acting with no human actor). */
  id: userIdSchema.optional(),
})
export type TimelineActor = z.infer<typeof timelineActorSchema>

/**
 * One entry in an order's or subOrder's `timeline` array. `status` is
 * deliberately a plain non-empty string rather than a shared enum — it holds
 * either an `orderStatusSchema` or `subOrderStatusSchema` value depending on
 * which document it lives on, and re-parsing the wrong enum on the wrong
 * document would fail for no useful reason. Every status-machine transition
 * Cloud Function appends exactly one of these; never edited or removed
 * afterwards, so it's an honest append-only audit trail.
 */
export const timelineEntrySchema = z.object({
  status: z.string().min(1),
  actor: timelineActorSchema,
  note: z.string().optional(),
  at: epochMsSchema,
})
export type TimelineEntry = z.infer<typeof timelineEntrySchema>
