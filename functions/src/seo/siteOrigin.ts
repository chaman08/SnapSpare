import type { Firestore } from 'firebase-admin/firestore'

/** Placeholder used only when config/app.siteOrigin is unset (e.g. a fresh dev/emulator project before the config doc's Phase 22 field is filled in) — never used in a real deploy, see configSchema's siteOrigin comment. */
const FALLBACK_SITE_ORIGIN = 'https://snapspare.app'

/** No trailing slash. Best-effort — a missing/unreadable config doc falls back rather than failing the sitemap/landing-page generation run over a config gap, unlike checkout's getAppConfig (money-path, deliberately strict). */
export async function getSiteOrigin(db: Firestore): Promise<string> {
  try {
    const snapshot = await db.collection('config').doc('app').get()
    const siteOrigin = (snapshot.data() as { siteOrigin?: string } | undefined)?.siteOrigin
    return siteOrigin ? siteOrigin.replace(/\/$/, '') : FALLBACK_SITE_ORIGIN
  } catch {
    return FALLBACK_SITE_ORIGIN
  }
}
