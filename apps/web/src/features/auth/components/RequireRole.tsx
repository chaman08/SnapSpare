import type { Role } from '@snapspare/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { useSellerStatus } from '@/features/auth/api/sellerStatus'
import { useRequireRole } from '@/features/auth/hooks/useRequireRole'

interface RequireRoleProps {
  requiredRole: Role
  children: ReactNode
}

function GuardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

/**
 * Route guard for /seller/* and /admin/*. Seller additionally requires the
 * seller's Firestore doc to have status 'active' — the custom claim alone
 * can go stale if a seller is suspended after the claim was issued.
 *
 * Prop is named `requiredRole` (not `role`) so eslint-plugin-jsx-a11y's
 * aria-role rule doesn't mistake it for the native ARIA `role` attribute.
 */
export function RequireRole({ requiredRole, children }: RequireRoleProps) {
  const { t } = useTranslation()
  const { claims, loading, allowed } = useRequireRole(requiredRole)
  const sellerId = requiredRole === 'seller' ? claims?.sellerId : undefined
  const sellerStatusQuery = useSellerStatus(sellerId)

  if (loading || !allowed) return <GuardSkeleton />

  if (requiredRole === 'seller') {
    if (sellerStatusQuery.isLoading) return <GuardSkeleton />
    if (sellerStatusQuery.data?.status !== 'active') {
      return (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <EmptyState
            title={t('auth.seller.notActiveTitle')}
            description={t('auth.seller.notActiveDescription')}
          />
        </div>
      )
    }
  }

  return <>{children}</>
}
