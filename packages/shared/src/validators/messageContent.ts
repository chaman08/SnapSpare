const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

/** Indian mobile numbers are 10 digits starting 6-9 (see mobileSchema in indian.ts). */
const PHONE_DIGIT_RUN = /[6-9]\d{9}/

export type ContactInfoKind = 'phone' | 'email'

/**
 * Heuristic scan for phone numbers/emails in RFQ message bodies (design spec
 * requirement 5: block contact-info sharing rather than silently strip it).
 * Email is a standard-shape regex. Phone strips every non-digit character
 * from the *whole* message first, then looks for a 10-digit run starting
 * 6-9 anywhere in that digit stream — this catches spaced/dashed/parenthesised
 * numbers ("98765 43210", "+91-98765-43210") that a naive word-boundary regex
 * would miss. Trade-off, deliberately accepted: a quoted 10-digit OEM/part
 * number starting 6-9 can false-positive. There's no allow-list for that today.
 */
export function findContactInfo(text: string): ContactInfoKind | null {
  if (EMAIL_PATTERN.test(text)) return 'email'
  const digitsOnly = text.replace(/[^0-9]/g, '')
  if (PHONE_DIGIT_RUN.test(digitsOnly)) return 'phone'
  return null
}

/**
 * Small English-oriented profanity deny-list, deliberately short (see
 * README-level guidance: real moderation needs a real provider; this is a
 * first line of defense, same trade-off findContactInfo already accepts).
 * Word-boundary matched so e.g. "class" never matches "ass".
 */
const PROFANITY_WORDS = ['fuck', 'shit', 'bitch', 'bastard', 'asshole', 'chutiya', 'madarchod', 'behenchod', 'randi']
const PROFANITY_PATTERN = new RegExp(`\\b(${PROFANITY_WORDS.join('|')})\\b`, 'i')

export function findProfanity(text: string): boolean {
  return PROFANITY_PATTERN.test(text)
}

/**
 * PAN (ABCDE1234F) and Aadhaar (12-digit, spaced in groups of 4) shape
 * checks — a review/Q&A body should never contain either. Aadhaar reuses the
 * same "strip non-digits, look for a run" trick as findContactInfo's phone
 * check so spacing/dashes don't defeat it, but requires 12 digits (not 10)
 * to avoid colliding with a phone-number false-positive.
 */
const PAN_PATTERN = /[A-Z]{5}\d{4}[A-Z]/
const AADHAAR_DIGIT_RUN = /\d{12}/

export function looksLikePII(text: string): boolean {
  if (PAN_PATTERN.test(text.toUpperCase())) return true
  const digitsOnly = text.replace(/[^0-9]/g, '')
  return AADHAAR_DIGIT_RUN.test(digitsOnly)
}
