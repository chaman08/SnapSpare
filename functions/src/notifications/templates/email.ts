import type { NotificationType } from '@snapspare/shared'
import { PUSH_TEMPLATES } from './push.js'
import type { ChannelRegistry } from './types.js'
import type { EmailTemplate } from '../channels/emailAdapter.js'

/**
 * Email reuses the same title/body already written for push (subject =
 * title, HTML body = a minimally-wrapped body) rather than a second copy of
 * near-identical wording — every type that has a push template gets an
 * email template for free. A dedicated subject/HTML per type can replace an
 * entry here later if richer email formatting is ever needed.
 */
type PushEntry = NonNullable<(typeof PUSH_TEMPLATES)[NotificationType]>

export const EMAIL_TEMPLATES: ChannelRegistry<EmailTemplate> = Object.fromEntries(
  (Object.entries(PUSH_TEMPLATES) as [NotificationType, PushEntry][]).map(
    ([type, langs]) => [
      type,
      {
        en: (vars: Parameters<typeof langs.en>[0]) => {
          const { title, body } = langs.en(vars)
          return { subject: title, html: `<p>${body}</p>` }
        },
        hi: (vars: Parameters<typeof langs.hi>[0]) => {
          const { title, body } = langs.hi(vars)
          return { subject: title, html: `<p>${body}</p>` }
        },
      },
    ],
  ),
) as ChannelRegistry<EmailTemplate>
