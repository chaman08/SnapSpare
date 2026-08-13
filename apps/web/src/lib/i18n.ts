import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'

// Eagerly bundles every src/locales/<code>/common.json — adding a new
// language directory (see SUPPORTED_LOCALES) is picked up automatically,
// no import list to maintain here.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*/common.json', {
  eager: true,
})

function loadCommon(code: string): Record<string, unknown> {
  const mod = localeModules[`../locales/${code}/common.json`]
  if (!mod) {
    throw new Error(`Missing src/locales/${code}/common.json for a language registered in SUPPORTED_LOCALES`)
  }
  return mod.default
}

const resources = Object.fromEntries(
  SUPPORTED_LOCALES.map(({ code }) => [code, { common: loadCommon(code) }]),
)

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
