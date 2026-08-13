import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { updateLanguagePreference } from '@/features/auth/api/profile'
import i18n from '@/lib/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { useSessionMetaStore } from '@/stores/sessionMetaStore'
import { cn } from '@/lib/utils'

/**
 * First-run "choose your language" prompt — the buyer-facing onboarding
 * surface the product spec calls for, shown once on a person's very first
 * session (there's no dedicated multi-step buyer onboarding flow in this
 * app; the language choice IS the onboarding moment for a first-time
 * visitor). Never reappears once dismissed, tracked via sessionMetaStore.
 */
export function LanguageOnboardingDialog() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const sessionCount = useSessionMetaStore((s) => s.sessionCount)
  const hasSeenLanguagePrompt = useSessionMetaStore((s) => s.hasSeenLanguagePrompt)
  const markLanguagePromptSeen = useSessionMetaStore((s) => s.markLanguagePromptSeen)
  const [selected, setSelected] = useState(i18n.language.split('-')[0])

  const open = sessionCount === 1 && !hasSeenLanguagePrompt

  useEffect(() => {
    setSelected(i18n.language.split('-')[0])
  }, [open])

  async function handleContinue() {
    await i18n.changeLanguage(selected)
    if (user && (selected === 'en' || selected === 'hi')) {
      await updateLanguagePreference(user.uid, selected)
    }
    markLanguagePromptSeen()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && markLanguagePromptSeen()}>
      <DialogContent onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('onboarding.language.title')}</DialogTitle>
          <DialogDescription>{t('onboarding.language.description')}</DialogDescription>
        </DialogHeader>

        <fieldset className="grid gap-2" role="radiogroup" aria-label={t('onboarding.language.title')}>
          {SUPPORTED_LOCALES.map((locale) => (
            <label
              key={locale.code}
              className={cn(
                'flex min-h-tap cursor-pointer items-center justify-between rounded-[6px] border px-4 py-3 text-base',
                selected === locale.code ? 'border-signal bg-signal/5 text-ink' : 'border-steel/20 text-ink',
              )}
            >
              <span>{locale.nativeLabel}</span>
              <input
                type="radio"
                name="onboarding-language"
                value={locale.code}
                checked={selected === locale.code}
                onChange={() => setSelected(locale.code)}
                className="h-5 w-5 accent-signal"
              />
            </label>
          ))}
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="cta" onClick={handleContinue}>
            {t('onboarding.language.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
