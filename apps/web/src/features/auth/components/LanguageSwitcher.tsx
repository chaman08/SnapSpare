import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { updateLanguagePreference } from '@/features/auth/api/profile'
import i18n from '@/lib/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/locales'

/**
 * Global language switcher, mounted in the header (always reachable) and in
 * LanguageOnboardingDialog (first-run). Changing it here updates the active
 * UI language immediately for guests and signed-in buyers alike; for a
 * signed-in buyer it also persists to their profile so it's remembered on
 * their next device (guest persistence is handled by
 * i18next-browser-languagedetector's localStorage cache).
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const activeCode = i18n.language.split('-')[0]

  async function handleChange(code: string) {
    await i18n.changeLanguage(code)
    if (user && (code === 'en' || code === 'hi')) {
      await updateLanguagePreference(user.uid, code)
    }
  }

  return (
    <Select value={activeCode} onValueChange={handleChange}>
      <SelectTrigger
        aria-label={t('auth.profile.language')}
        className={compact ? 'w-auto gap-1.5 border-none bg-transparent px-2' : 'w-40'}
      >
        <Languages className="h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((locale) => (
          <SelectItem key={locale.code} value={locale.code}>
            {locale.nativeLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
