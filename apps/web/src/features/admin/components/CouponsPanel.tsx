import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveCoupon, useCoupons } from '@/features/admin/api/marketingActions'
import { cn } from '@/lib/utils'

function daysFromNow(days: number): number {
  return Date.now() + days * 24 * 60 * 60_000
}

/** Marketing module's coupon builder (design brief item 9). */
export function CouponsPanel() {
  const { t } = useTranslation()
  const { coupons, loading } = useCoupons()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [validDays, setValidDays] = useState('30')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      await saveCoupon({
        code: code.trim().toUpperCase(),
        discountType,
        discountPercent: discountType === 'percent' ? Number(discountValue) : undefined,
        discountAmountPaise: discountType === 'flat' ? Math.round(Number(discountValue) * 100) : undefined,
        validFrom: Date.now(),
        validUntil: daysFromNow(Number(validDays) || 30),
        status: 'active',
      })
      toast.success(t('admin.marketing.coupons.saveSuccess'))
      setOpen(false)
      setCode('')
      setDiscountValue('')
    } catch {
      toast.error(t('admin.marketing.coupons.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('admin.marketing.coupons.newAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : coupons.length === 0 ? (
        <EmptyState title={t('admin.marketing.coupons.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.marketing.coupons.code')}</TableHead>
              <TableHead>{t('admin.marketing.coupons.discount')}</TableHead>
              <TableHead>{t('admin.marketing.coupons.usage')}</TableHead>
              <TableHead>{t('admin.marketing.coupons.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id}>
                <TableCell className="font-mono text-xs">{coupon.code}</TableCell>
                <TableCell className="font-mono text-xs">
                  {coupon.discountType === 'percent' ? `${coupon.discountPercent}%` : formatINR(coupon.discountAmountPaise)}
                </TableCell>
                <TableCell className="text-xs text-steel">
                  {coupon.usedCount}
                  {coupon.usageLimitTotal ? ` / ${coupon.usageLimitTotal}` : ''}
                </TableCell>
                <TableCell>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', coupon.status === 'active' ? 'bg-verify/10 text-verify' : 'bg-steel/10 text-steel')}>
                    {coupon.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.marketing.coupons.newAction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="coupon-code">{t('admin.marketing.coupons.code')}</Label>
              <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
            </div>
            <div className="flex gap-2">
              <select
                className="flex min-h-tap rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'flat')}
                disabled={busy}
              >
                <option value="percent">{t('admin.marketing.coupons.percentOff')}</option>
                <option value="flat">{t('admin.marketing.coupons.flatOff')}</option>
              </select>
              <Input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '%' : '₹'}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="coupon-valid-days">{t('admin.marketing.coupons.validDays')}</Label>
              <Input id="coupon-valid-days" type="number" min={1} value={validDays} onChange={(e) => setValidDays(e.target.value)} disabled={busy} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            <Button size="sm" onClick={create} disabled={busy || !code.trim() || !discountValue.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
