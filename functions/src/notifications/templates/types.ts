import type { NotificationType } from '@snapspare/shared'

/** Interpolation source for every channel renderer — the notification doc's `data` bag plus its orderId/subOrderId/returnId/rfqId fields flattened in by processNotificationChannels.ts. */
export type TemplateVars = Record<string, string>

export type Renderer<T> = (vars: TemplateVars) => T

/** A channel-specific template registry only needs entries for the NotificationType values it actually supports — getTemplate() returns undefined for the rest, which the dispatcher treats as "skip this channel for this type", not a failure. */
export type ChannelRegistry<T> = Partial<Record<NotificationType, { en: Renderer<T>; hi: Renderer<T> }>>
