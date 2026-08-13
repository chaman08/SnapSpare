import {
  type ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

/** The login page must render an empty `<div id={RECAPTCHA_CONTAINER_ID} />` for the invisible widget to attach to. */
export const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

let recaptchaVerifier: RecaptchaVerifier | undefined

function getRecaptchaVerifier(): RecaptchaVerifier {
  recaptchaVerifier ??= new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
    size: 'invisible',
  })
  return recaptchaVerifier
}

/** India-only for now: accepts a 10-digit local number and adds the +91 country code. */
export function toE164India(localNumber: string): string {
  return `+91${localNumber}`
}

export async function sendOtp(localPhoneNumber: string): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier()
  try {
    return await signInWithPhoneNumber(auth, toE164India(localPhoneNumber), verifier)
  } catch (error) {
    // A failed send can leave the invisible widget in a bad state — force a fresh one next attempt.
    recaptchaVerifier?.clear()
    recaptchaVerifier = undefined
    throw error
  }
}

/** Maps Firebase Auth error codes to i18next keys under the `auth.errors` namespace. */
export function mapAuthErrorToI18nKey(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'auth.errors.invalidPhone'
    case 'auth/invalid-verification-code':
      return 'auth.errors.wrongOtp'
    case 'auth/code-expired':
      return 'auth.errors.otpExpired'
    case 'auth/too-many-requests':
      return 'auth.errors.tooManyRequests'
    case 'auth/quota-exceeded':
      return 'auth.errors.quotaExceeded'
    case 'auth/network-request-failed':
      return 'auth.errors.network'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'auth.errors.popupClosed'
    default:
      return 'auth.errors.generic'
  }
}
