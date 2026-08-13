import { useTranslation } from 'react-i18next'
import type { GstDisplayMode } from '@/features/catalog/lib/gstDisplay'
import { cn } from '@/lib/utils'

interface GstToggleProps {
  mode: GstDisplayMode
  onChange: (mode: GstDisplayMode) => void
  className?: string
}

/** Business-buyer-only price display toggle (GST inclusive/exclusive) — never changes what's payable, only how the same server-priced number is presented. Always labels which mode is active, per the design spec. */
export function GstToggle({ mode, onChange, className }: GstToggleProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-xs text-steel">{t('product.detail.gst.label')}</span>
      <div role="group" aria-label={t('product.detail.gst.label')} className="inline-flex rounded-[6px] border border-steel/30">
        {(['exclusive', 'inclusive'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onChange(option)}
            className={cn(
              'min-h-tap px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
              mode === option ? 'bg-ink text-surface' : 'text-steel hover:bg-surface-muted',
            )}
          >
            {t(`product.detail.gst.${option}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
