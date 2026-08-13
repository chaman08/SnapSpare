import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { usePreferencesStore } from '@/stores/preferencesStore'

/**
 * Device-level preference, not an account one — available to signed-out
 * visitors too (unlike the rest of AccountPage's content), since it's
 * persisted in localStorage via preferencesStore rather than the user's
 * Firestore profile. Gates image size (ResponsiveImage), autoplay (none
 * currently ships, but this is the switch any future carousel must check),
 * and how aggressively the catalogue grid prefetches ahead of scroll
 * (VirtualizedGrid).
 */
export function LowDataModeToggle() {
  const { t } = useTranslation()
  const id = useId()
  const lowDataMode = usePreferencesStore((s) => s.lowDataMode)
  const setLowDataMode = usePreferencesStore((s) => s.setLowDataMode)

  return (
    <div className="flex items-start gap-3 rounded-[6px] border border-steel/20 p-4">
      <Checkbox
        id={id}
        checked={lowDataMode}
        onChange={(e) => setLowDataMode(e.target.checked)}
        aria-describedby={`${id}-description`}
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium text-ink">{t('preferences.lowDataMode.label')}</span>
        <span id={`${id}-description`} className="block text-sm text-steel">
          {t('preferences.lowDataMode.description')}
        </span>
      </label>
    </div>
  )
}
