import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addDisputeEvidence } from '@/features/orders/api/disputeActions'
import { uploadPostSaleEvidence } from '@/features/orders/api/postSaleEvidence'
import { useSellerDisputes } from '@/features/seller/api/useSellerDisputes'

export default function SellerDisputesPage() {
  const { t } = useTranslation()
  const { user, claims } = useAuth()
  const { disputes, loading } = useSellerDisputes(claims?.sellerId)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  async function handleAddEvidence(disputeId: string, fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file || !user) return
    setUploadingId(disputeId)
    try {
      const path = await uploadPostSaleEvidence(user.uid, 'disputes', file)
      await addDisputeEvidence({ disputeId, url: path })
      toast.success(t('sellerWarrantyClaims.actionSuccess'))
    } catch {
      toast.error(t('sellerWarrantyClaims.actionFailed'))
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerDisputes.title')}</h1>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : disputes.length === 0 ? (
        <EmptyState title={t('sellerDisputes.emptyTitle')} description={t('sellerDisputes.emptyDescription')} />
      ) : (
        <ul className="space-y-3">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="rounded-[6px] border border-steel/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm text-ink">{dispute.subOrderId}</p>
                <span className="rounded-[6px] bg-steel/10 px-2 py-0.5 text-xs font-medium text-steel">
                  {t(`sellerDisputes.status.${dispute.status}`)}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{dispute.reasonNotes}</p>
              {dispute.evidence.length > 0 ? (
                <p className="mt-1 text-xs text-steel">
                  {t('sellerDisputes.reasonLabel')}: {dispute.evidence.length}
                </p>
              ) : null}
              {dispute.status !== 'resolved' ? (
                <div className="mt-3">
                  <label htmlFor={`dispute-evidence-${dispute.id}`} className="text-sm font-medium text-ink">
                    {t('sellerDisputes.addEvidence')}
                  </label>
                  <input
                    id={`dispute-evidence-${dispute.id}`}
                    type="file"
                    accept="image/*"
                    disabled={uploadingId === dispute.id}
                    onChange={(event) => {
                      void handleAddEvidence(dispute.id, event.target.files)
                      event.target.value = ''
                    }}
                    className="mt-1 block w-full text-sm text-steel"
                  />
                </div>
              ) : null}
              {dispute.resolution ? (
                <p className="mt-2 rounded-[6px] bg-verify/5 p-2 text-sm text-verify">{dispute.resolution.adminNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
