import type { FitmentStatus } from '@snapspare/shared'
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface FitmentBarProps {
  status: FitmentStatus
  vehicleLabel?: string
  onClick?: () => void
}

const STYLES: Record<FitmentStatus, string> = {
  fits: 'bg-verify/10 text-verify',
  does_not_fit: 'bg-alert/10 text-alert',
  unverified: 'bg-surface-muted text-steel',
}

const ICONS: Record<FitmentStatus, typeof CheckCircle2> = {
  fits: CheckCircle2,
  does_not_fit: AlertTriangle,
  unverified: HelpCircle,
}

const LABEL_KEYS: Record<FitmentStatus, string> = {
  fits: 'fitment.fits',
  does_not_fit: 'fitment.doesNotFit',
  unverified: 'fitment.unverified',
}

/**
 * Persistent fitment bar. This is a signature, always-visible element: it must
 * render one of FITS / DOES_NOT_FIT / UNVERIFIED on every catalog and PDP screen.
 */
export function FitmentBar({ status, vehicleLabel, onClick }: FitmentBarProps) {
  const { t } = useTranslation()
  const Icon = ICONS[status]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(
        'flex min-h-tap w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition-colors',
        STYLES[status],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{vehicleLabel ?? t(LABEL_KEYS[status])}</span>
    </button>
  )
}
