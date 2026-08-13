import type { NotificationChannel, NotificationType } from '@snapspare/shared'
import type { EmailTemplate } from '../channels/emailAdapter.js'
import type { PushTemplate } from '../channels/pushAdapter.js'
import type { WhatsappTemplate } from '../channels/whatsappAdapter.js'
import { EMAIL_TEMPLATES } from './email.js'
import { PUSH_TEMPLATES } from './push.js'
import { SMS_TEMPLATES } from './sms.js'
import type { TemplateVars } from './types.js'
import { WHATSAPP_TEMPLATES } from './whatsapp.js'

export type { TemplateVars } from './types.js'

interface ChannelTemplateMap {
  push: PushTemplate
  sms: string
  whatsapp: WhatsappTemplate
  email: EmailTemplate
}

const REGISTRIES = {
  push: PUSH_TEMPLATES,
  sms: SMS_TEMPLATES,
  whatsapp: WHATSAPP_TEMPLATES,
  email: EMAIL_TEMPLATES,
} as const

/**
 * Looks up and renders the template for (type, channel, language). Returns
 * undefined when this type has no template registered for this channel
 * (most types only cover push+email — see sms.ts/whatsapp.ts's doc
 * comments) — processNotificationChannels.ts treats that as "skip this
 * channel", not a failure.
 */
export function getTemplate<C extends NotificationChannel>(
  type: NotificationType,
  channel: C,
  language: 'en' | 'hi',
  vars: TemplateVars,
): ChannelTemplateMap[C] | undefined {
  const registry = REGISTRIES[channel] as Partial<
    Record<NotificationType, { en: (v: TemplateVars) => ChannelTemplateMap[C]; hi: (v: TemplateVars) => ChannelTemplateMap[C] }>
  >
  const entry = registry[type]
  if (!entry) return undefined
  return entry[language](vars)
}
