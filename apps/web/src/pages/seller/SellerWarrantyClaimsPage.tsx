import type { WarrantyClaim } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { decideWarrantyClaim } from '@/features/orders/api/warrantyClaimActions'
import { useSellerWarrantyClaims } from '@/features/seller/api/useSellerWarrantyClaims'

export default function SellerWarrantyClaimsPage() {
  const { t } = useTranslation()
  const { claims: allClaims, loading } = useSellerWarrantyClaims(useAuth().claims?.sellerId)
  const [busyId, setBusyId] = useState<string | null>(null)

  const claims = allClaims.filter((c) => c.status === 'submitted' || c.status === 'seller_review')
  const history = allClaims.filter((c) => c.status !== 'submitted' && c.status !== 'seller_review')

  async function handleAction(claim: WarrantyClaim, action: 'approve' | 'reject' | 'escalate_to_brand') {
    setBusyId(claim.id)
    try {
      await decideWarrantyClaim({ claimId: claim.id, action })
      toast.success(t('sellerWarrantyClaims.actionSuccess'))
    } catch {
      toast.error(t('sellerWarrantyClaims.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerWarrantyClaims.title')}</h1>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : allClaims.length === 0 ? (
        <EmptyState title={t('sellerWarrantyClaims.emptyTitle')} description={t('sellerWarrantyClaims.emptyDescription')} />
      ) : (
        <ul className="space-y-3">
          {[...claims, ...history].map((claim) => (
            <li key={claim.id} className="rounded-[6px] border border-steel/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-ink">{claim.partNumber}</p>
                  <p className="text-xs text-steel">{t(`sellerWarrantyClaims.status.${claim.status}`)}</p>
                </div>
                <span className="text-xs text-steel">{t(`orders.warranty.reasons.${claim.reason}`)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{claim.description}</p>
              {claim.status === 'submitted' || claim.status === 'seller_review' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="cta" size="sm" disabled={busyId === claim.id} onClick={() => handleAction(claim, 'approve')}>
                    {t('sellerWarrantyClaims.approve')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busyId === claim.id} onClick={() => handleAction(claim, 'reject')}>
                    {t('sellerWarrantyClaims.reject')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === claim.id}
                    onClick={() => handleAction(claim, 'escalate_to_brand')}
                  >
                    {t('sellerWarrantyClaims.escalateToBrand')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
