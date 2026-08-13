import { z } from 'zod'
import { notificationIdSchema } from '../ids'
import { callableRequestSchema } from './common'

export const registerFcmTokenRequestSchema = callableRequestSchema(
  z.object({
    token: z.string().min(1),
  }),
)
export type RegisterFcmTokenRequest = z.infer<typeof registerFcmTokenRequestSchema>

export const unregisterFcmTokenRequestSchema = callableRequestSchema(
  z.object({
    token: z.string().min(1),
  }),
)
export type UnregisterFcmTokenRequest = z.infer<typeof unregisterFcmTokenRequestSchema>

export const markNotificationReadRequestSchema = callableRequestSchema(
  z.object({
    notificationId: notificationIdSchema,
  }),
)
export type MarkNotificationReadRequest = z.infer<typeof markNotificationReadRequestSchema>

export const updateNotificationPreferencesRequestSchema = callableRequestSchema(
  z.object({
    channels: z
      .object({
        push: z.boolean().optional(),
        sms: z.boolean().optional(),
        whatsapp: z.boolean().optional(),
        email: z.boolean().optional(),
      })
      .optional(),
    marketingOptOut: z.boolean().optional(),
  }),
)
export type UpdateNotificationPreferencesRequest = z.infer<typeof updateNotificationPreferencesRequestSchema>
