import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDownloadURL, ref } from 'firebase/storage'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { reviewBrandAuthorization, usePendingBrandAuthorizations } from '@/features/admin/api/brandAuthorizationActions'
import { storage } from '@/lib/firebase'

/** Admin review queue for seller-submitted brand-authorization documents (design brief item 4: "Never award a badge without a document"). */
export function BrandAuthorizationsQueue() {
  const { t } = useTranslation()
  const { authorizations, loading } = usePendingBrandAuthorizations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})

  async function handleViewDocument(documentUrl: string) {
    try {
      const url = await getDownloadURL(ref(storage, documentUrl))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  async function handleVerify(id: string) {
    setBusyId(id)
    try {
      await reviewBrandAuthorization({ id, decision: 'verified' })
      toast.success(t('admin.brandAuthorizations.action.verifySuccess'))
    } catch {
      toast.error(t('admin.brandAuthorizations.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id: string) {
    const rejectedReason = rejectReasons[id]?.trim()
    if (!rejectedReason) return
    setBusyId(id)
    try {
      await reviewBrandAuthorization({ id, decision: 'rejected', rejectedReason })
      toast.success(t('admin.brandAuthorizations.action.rejectSuccess'))
    } catch {
      toast.error(t('admin.brandAuthorizations.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (authorizations.length === 0) {
    return <EmptyState title={t('admin.brandAuthorizations.emptyTitle')} description={t('admin.brandAuthorizations.emptyDescription')} />
  }

  return (
    <ul className="space-y-3">
      {authorizations.map((auth) => (
        <li key={auth.id} className="space-y-2 rounded-[6px] border border-steel/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-ink">{auth.brandName}</p>
            <p className="font-mono text-xs text-steel">{auth.sellerId}</p>
          </div>
          {auth.categorySlugs && auth.categorySlugs.length > 0 ? (
            <p className="text-xs text-steel">{auth.categorySlugs.join(', ')}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => handleViewDocument(auth.documentUrl)}>
            {t('admin.brandAuthorizations.viewDocument')}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t('admin.brandAuthorizations.rejectReasonPlaceholder')}
              value={rejectReasons[auth.id] ?? ''}
              onChange={(e) => setRejectReasons((prev) => ({ ...prev, [auth.id]: e.target.value }))}
              className="max-w-xs"
            />
            <Button type="button" variant="destructive" size="sm" disabled={busyId === auth.id || !rejectReasons[auth.id]?.trim()} onClick={() => handleReject(auth.id)}>
              {t('admin.brandAuthorizations.action.reject')}
            </Button>
            <Button type="button" variant="cta" size="sm" disabled={busyId === auth.id} onClick={() => handleVerify(auth.id)}>
              {t('admin.brandAuthorizations.action.verify')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
