import { userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type { ChannelSendArgs, ChannelSendResult } from './types.js'

/** Indian 10-digit mobile numbers are stored without a country code (see mobileSchema) — MSG91 needs a country-code-prefixed number. */
function toE164India(mobile: string): string {
  return `91${mobile}`
}

export async function sendSms(
  args: ChannelSendArgs,
  text: string,
  env: { apiKey: string; senderId: string; route: string },
): Promise<ChannelSendResult> {
  const db = getFirestore()
  const snapshot = await db.collection('users').doc(args.userId).get()
  if (!snapshot.exists) return { ok: false, error: 'user_not_found' }

  const parsed = userSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  if (!parsed.success || !parsed.data.phone) return { ok: false, error: 'no_phone_on_file' }

  const url = new URL('https://api.msg91.com/api/sendhttp.php')
  url.searchParams.set('authkey', env.apiKey)
  url.searchParams.set('mobiles', toE164India(parsed.data.phone))
  url.searchParams.set('message', text)
  url.searchParams.set('sender', env.senderId)
  url.searchParams.set('route', env.route)
  url.searchParams.set('response', 'json')

  const response = await fetch(url, { method: 'POST' })
  const body = (await response.json().catch(() => undefined)) as
    | { type?: string; message?: string }
    | undefined

  if (!response.ok || body?.type === 'error') {
    return { ok: false, error: body?.message ?? `msg91_api_${response.status}` }
  }
  return { ok: true, providerMessageId: body?.message }
}
