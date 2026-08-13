import type { FitmentStatus } from '@snapspare/shared'
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFitmentCheck } from '@/features/catalog/api/fitment'
import { cn } from '@/lib/utils'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

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

interface FitmentBadgeProps {
  partId: string
  /** 'sm' for product cards/cart lines, 'lg' for the product page (design system: "large, above the fold"). */
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * The three-state fitment indicator (design system: FITS / DOES_NOT_FIT /
 * UNVERIFIED), driven by the buyer's active vehicle. Every mount runs its
 * own `checkFitment` call keyed on (partId, active vehicle) — deliberately
 * not batched, so a badge dropped onto a cart line always reflects the
 * *current* active vehicle even if it changed since the cart was last
 * loaded (see CartFitmentGuard, which relies on exactly this).
 */
export function FitmentBadge({ partId, size = 'sm', className }: FitmentBadgeProps) {
  const { t } = useTranslation()
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const { data, isFetching } = useFitmentCheck(partId, activeVehicle)
  const status: FitmentStatus = activeVehicle ? (data?.status ?? 'unverified') : 'unverified'
  const Icon = ICONS[status]

  if (size === 'lg') {
    return (
      <div
        aria-live="polite"
        className={cn(
          'flex min-h-tap w-full items-center gap-2 rounded-[6px] px-4 py-3 text-base font-medium transition-opacity',
          STYLES[status],
          isFetching && 'opacity-70',
          className,
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{t(LABEL_KEYS[status])}</span>
      </div>
    )
  }

  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-opacity',
        STYLES[status],
        isFetching && 'opacity-70',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t(LABEL_KEYS[status])}
    </span>
  )
}
