/**
 * Registry of locales the app can render in. Adding a new language (mr, ta,
 * te, kn, gu, bn, …) is a data-only change: drop a `common.json` under
 * `src/locales/<code>/` (see scripts/check-i18n-keys.mjs for the CI gate that
 * enforces full key parity with English) and add one entry below. No other
 * source file needs to change — src/lib/i18n.ts discovers translation files
 * via import.meta.glob, and every UI that lists languages (LanguageSwitcher,
 * ProfileForm, LanguageOnboardingDialog) reads this array.
 */
export interface LocaleMeta {
  code: string
  /** English name, used as a fallback label. */
  label: string
  /** Name written in the language itself, shown in pickers. */
  nativeLabel: string
  dir: 'ltr' | 'rtl'
  /** Set for languages whose script needs the Devanagari web font subset. */
  devanagari?: boolean
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr', devanagari: true },
]

export const DEFAULT_LOCALE = 'en'

const FALLBACK_LOCALE: LocaleMeta = SUPPORTED_LOCALES[0]!

export function getLocaleMeta(code: string): LocaleMeta {
  const short = code.split('-')[0]
  return SUPPORTED_LOCALES.find((l) => l.code === short) ?? FALLBACK_LOCALE
}
