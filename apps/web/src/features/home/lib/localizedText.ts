interface LocalizedText {
  en: string
  hi: string
}

/** Picks the buyer's current-language string from an admin-authored `{en, hi}` field, falling back to English for any i18next language code other than 'hi'. */
export function pickLocalizedText(text: LocalizedText | undefined, language: string): string | undefined {
  if (!text) return undefined
  return language.startsWith('hi') ? text.hi : text.en
}
