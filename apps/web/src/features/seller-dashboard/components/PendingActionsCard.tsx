import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface PendingActionsCardProps {
  needsAcceptCount: number
  needsPackCount: number
  isLoading: boolean
}

/** Requirement 6's "pending actions" panel — counts only, deep-linking to the orders page where the seller actually acts. */
export function PendingActionsCard({ needsAcceptCount, needsPackCount, isLoading }: PendingActionsCardProps) {
  const { t } = useTranslation()

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="pending-actions-heading">
      <h2 id="pending-actions-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.pendingActions.title')}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3" aria-live="polite">
        <Link
          to="/seller/orders"
          className="rounded-[6px] border border-steel/20 p-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <p className="font-mono text-2xl font-semibold text-ink">{isLoading ? '—' : needsAcceptCount}</p>
          <p className="text-sm text-steel">{t('sellerDashboard.pendingActions.needsAccept')}</p>
        </Link>
        <Link
          to="/seller/orders"
          className="rounded-[6px] border border-steel/20 p-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <p className="font-mono text-2xl font-semibold text-ink">{isLoading ? '—' : needsPackCount}</p>
          <p className="text-sm text-steel">{t('sellerDashboard.pendingActions.needsPack')}</p>
        </Link>
      </div>
    </section>
  )
}
