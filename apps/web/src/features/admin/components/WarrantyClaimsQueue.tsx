import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useEscalatedWarrantyClaims } from '@/features/admin/api/warrantyClaimActions'

export function WarrantyClaimsQueue() {
  const { t } = useTranslation()
  const { claims, loading } = useEscalatedWarrantyClaims()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (claims.length === 0) {
    return <EmptyState title={t('admin.warrantyClaims.emptyTitle')} description={t('admin.warrantyClaims.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {claims.map((claim) => (
        <li key={claim.id}>
          <Link
            to={`/admin/warranty-claims/${claim.id}`}
            className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
          >
            <div>
              <p className="font-mono text-sm text-ink">{claim.partNumber}</p>
              <p className="line-clamp-1 text-xs text-steel">{claim.description}</p>
            </div>
            <span className="rounded-full bg-signal/10 px-2 py-0.5 text-xs font-medium text-signal">
              {t(`admin.warrantyClaims.status.${claim.status}`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
