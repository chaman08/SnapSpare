import i18n from './i18n'
import { getLocaleMeta } from '@/i18n/locales'

const DEVANAGARI_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap'
const FONT_LINK_ID = 'locale-devanagari-font'

/**
 * Keeps <html lang>/<html dir> in sync with the active i18next language, and
 * loads the Devanagari font subset only while a Devanagari-script language
 * (hi today; mr/gu tomorrow) is active — Inter/Saira/IBM Plex Mono (the
 * default type stack) have no Devanagari glyphs, and we don't want to ship
 * that font's bytes to buyers reading English.
 */
function applyLocaleToDocument(language: string) {
  const meta = getLocaleMeta(language)
  document.documentElement.lang = meta.code
  document.documentElement.dir = meta.dir
  document.documentElement.classList.toggle('font-devanagari-active', Boolean(meta.devanagari))

  const existingLink = document.getElementById(FONT_LINK_ID)
  if (meta.devanagari) {
    if (!existingLink) {
      const link = document.createElement('link')
      link.id = FONT_LINK_ID
      link.rel = 'stylesheet'
      link.href = DEVANAGARI_FONT_HREF
      document.head.appendChild(link)
    }
  } else {
    existingLink?.remove()
  }
}

export function initLocaleFontLoader() {
  applyLocaleToDocument(i18n.language)
  i18n.on('languageChanged', applyLocaleToDocument)
}
