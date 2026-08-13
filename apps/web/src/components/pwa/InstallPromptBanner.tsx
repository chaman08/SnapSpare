import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useSessionMetaStore } from '@/stores/sessionMetaStore'

/** Not yet in lib.dom.d.ts — see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Shows a bottom banner offering to install the PWA — never on a person's
 * first session (per the product spec), only from their second session
 * onward, and never again once they've dismissed it once or already
 * installed. The browser only ever fires `beforeinstallprompt` once per
 * page load if install criteria are met, so we capture and hold onto it
 * until we're allowed to show our own UI for it.
 */
export function InstallPromptBanner() {
  const { t } = useTranslation()
  const sessionCount = useSessionMetaStore((s) => s.sessionCount)
  const hasDismissedInstallPrompt = useSessionMetaStore((s) => s.hasDismissedInstallPrompt)
  const markInstallPromptDismissed = useSessionMetaStore((s) => s.markInstallPromptDismissed)
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setInstalled(true)
      setDeferredEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const eligible = sessionCount >= 2 && !hasDismissedInstallPrompt && !installed && deferredEvent

  if (!eligible) return null

  async function handleInstall() {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    if (outcome === 'accepted') setInstalled(true)
    markInstallPromptDismissed()
    setDeferredEvent(null)
  }

  return (
    <div
      role="region"
      aria-label={t('pwa.installPrompt.title')}
      className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-md items-center gap-3 rounded-[6px] border border-steel/20 bg-surface p-3 shadow-lg md:bottom-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{t('pwa.installPrompt.title')}</p>
        <p className="text-xs text-steel">{t('pwa.installPrompt.description')}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={markInstallPromptDismissed}>
        {t('pwa.installPrompt.dismiss')}
      </Button>
      <Button type="button" variant="cta" size="sm" onClick={handleInstall}>
        {t('pwa.installPrompt.install')}
      </Button>
    </div>
  )
}
