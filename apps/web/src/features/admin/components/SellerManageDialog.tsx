import type { Seller } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminUpdateSeller } from '@/features/admin/api/sellerAdminActions'

interface SellerManageDialogProps {
  seller: Seller | null
  onOpenChange: (open: boolean) => void
}

/** One dialog handling both seller-status actions (suspend/reinstate) and the commission override — everything a Sellers-module row action needs. */
export function SellerManageDialog({ seller, onOpenChange }: SellerManageDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [commission, setCommission] = useState('')
  const [busy, setBusy] = useState(false)

  if (!seller) return null

  const commissionPlaceholder = seller.commissionRatePercent !== undefined ? String(seller.commissionRatePercent) : t('admin.sellers.commissionPlatformDefault')

  async function runSuspend() {
    if (!seller || reason.trim().length === 0) return
    setBusy(true)
    try {
      await adminUpdateSeller({ action: 'suspend', sellerId: seller.id, reason: reason.trim() })
      toast.success(t('admin.sellers.suspendSuccess'))
      onOpenChange(false)
    } catch {
      toast.error(t('admin.sellers.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function runReinstate() {
    if (!seller) return
    setBusy(true)
    try {
      await adminUpdateSeller({ action: 'reinstate', sellerId: seller.id })
      toast.success(t('admin.sellers.reinstateSuccess'))
      onOpenChange(false)
    } catch {
      toast.error(t('admin.sellers.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function runSetCommission() {
    if (!seller) return
    const trimmed = commission.trim()
    const value = trimmed.length === 0 ? null : Number(trimmed)
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) {
      toast.error(t('admin.sellers.commissionInvalid'))
      return
    }
    setBusy(true)
    try {
      await adminUpdateSeller({ action: 'setCommission', sellerId: seller.id, commissionRatePercent: value })
      toast.success(t('admin.sellers.commissionSaved'))
      setCommission('')
    } catch {
      toast.error(t('admin.sellers.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(seller)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{seller.businessName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-sm font-medium text-ink">{t('admin.sellers.statusSection')}</p>
            {seller.status === 'active' ? (
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">{t('admin.sellers.suspendReasonLabel')}</Label>
                <Input id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
                <Button variant="destructive" size="sm" onClick={runSuspend} disabled={busy || reason.trim().length === 0}>
                  {t('admin.sellers.suspend')}
                </Button>
              </div>
            ) : seller.status === 'suspended' ? (
              <Button variant="outline" size="sm" onClick={runReinstate} disabled={busy}>
                {t('admin.sellers.reinstate')}
              </Button>
            ) : (
              <p className="text-xs text-steel">{t('admin.sellers.statusNotManageable', { status: seller.status })}</p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="commission-rate">{t('admin.sellers.commissionLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="commission-rate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder={commissionPlaceholder}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                disabled={busy}
              />
              <Button variant="outline" size="sm" onClick={runSetCommission} disabled={busy}>
                {t('common.save')}
              </Button>
            </div>
            <p className="text-xs text-steel">{t('admin.sellers.commissionHint')}</p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
