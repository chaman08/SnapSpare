import { formatINR, toPaise } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { approveCreditLimit } from '@/features/credit/api/creditActions'
import { usePendingCreditLimitRequests } from '@/features/credit/api/useCreditLimitRequests'

/** Admin approval queue for Khata credit-limit requests (design brief item 7). Every decision goes through approveCreditLimit.ts, which always logs a limitChanges entry. */
export function CreditApprovalsPanel() {
  const { t } = useTranslation()
  const { requests, loading } = usePendingCreditLimitRequests()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleApprove(requestId: string, buyerId: string) {
    const rupees = Number(drafts[requestId])
    if (!Number.isFinite(rupees) || rupees <= 0) return
    setBusyId(requestId)
    try {
      await approveCreditLimit({ creditLimitRequestId: requestId, buyerId, approved: true, newLimitPaise: toPaise(rupees) })
      toast.success(t('admin.credit.approved'))
    } catch {
      toast.error(t('admin.credit.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(requestId: string, buyerId: string) {
    setBusyId(requestId)
    try {
      await approveCreditLimit({ creditLimitRequestId: requestId, buyerId, approved: false })
      toast.success(t('admin.credit.rejected'))
    } catch {
      toast.error(t('admin.credit.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Skeleton className="h-40 w-full" />
  if (requests.length === 0) {
    return <EmptyState title={t('admin.credit.emptyTitle')} description={t('admin.credit.emptyDescription')} />
  }

  return (
    <ul className="space-y-3">
      {requests.map((req) => (
        <li key={req.id} className="rounded-[6px] border border-steel/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm text-ink">{req.buyerId}</p>
              <p className="text-xs text-steel">
                {t('admin.credit.requested')}: {formatINR(req.requestedLimitPaise)}
                {req.reason ? ` — ${req.reason}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={1}
                value={drafts[req.id] ?? String(req.requestedLimitPaise / 100)}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))}
                className="w-32"
                aria-label={t('admin.credit.approvedLimit')}
              />
              <Button
                type="button"
                variant="cta"
                size="sm"
                disabled={busyId === req.id}
                onClick={() => void handleApprove(req.id, req.buyerId)}
              >
                {t('admin.credit.approve')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === req.id}
                onClick={() => void handleReject(req.id, req.buyerId)}
              >
                {t('admin.credit.reject')}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
