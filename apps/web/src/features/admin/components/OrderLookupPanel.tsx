import { formatINR, orderStatusSchema } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminForceOrderAction, useOrderLookup } from '@/features/admin/api/orderAdminActions'

/** Orders module (design brief item 6): exact-id lookup, force order-level status, and per-subOrder force-cancel / force-refund. Full-text order search is out of scope here — see the module's left-out note. */
export function OrderLookupPanel() {
  const { t } = useTranslation()
  const { order, subOrders, loading, lookup } = useOrderLookup()
  const [orderIdInput, setOrderIdInput] = useState('')
  const [forceStatus, setForceStatus] = useState<string>('')
  const [statusReason, setStatusReason] = useState('')
  const [busySubOrderId, setBusySubOrderId] = useState<string | null>(null)
  const [busyStatus, setBusyStatus] = useState(false)

  async function runForceStatus() {
    if (!order || !forceStatus || statusReason.trim().length === 0) return
    setBusyStatus(true)
    try {
      await adminForceOrderAction({ action: 'forceStatus', orderId: order.id, status: forceStatus as never, reason: statusReason.trim() })
      toast.success(t('admin.orders.forceStatusSuccess'))
      await lookup(order.id)
    } catch {
      toast.error(t('admin.orders.actionFailed'))
    } finally {
      setBusyStatus(false)
    }
  }

  async function runForceCancel(subOrderId: string) {
    const reason = window.prompt(t('admin.orders.forceCancelReasonPrompt'))
    if (!reason || reason.trim().length === 0) return
    setBusySubOrderId(subOrderId)
    try {
      await adminForceOrderAction({ action: 'forceCancelSubOrder', subOrderId, reason: reason.trim() })
      toast.success(t('admin.orders.forceCancelSuccess'))
      if (order) await lookup(order.id)
    } catch {
      toast.error(t('admin.orders.actionFailed'))
    } finally {
      setBusySubOrderId(null)
    }
  }

  async function runForceRefund(subOrderId: string) {
    const amountInput = window.prompt(t('admin.orders.forceRefundAmountPrompt'))
    if (!amountInput) return
    const amountRupees = Number(amountInput)
    if (Number.isNaN(amountRupees) || amountRupees <= 0) {
      toast.error(t('admin.orders.forceRefundInvalidAmount'))
      return
    }
    const reason = window.prompt(t('admin.orders.forceRefundReasonPrompt'))
    if (!reason || reason.trim().length === 0) return
    setBusySubOrderId(subOrderId)
    try {
      await adminForceOrderAction({
        action: 'forceRefund',
        subOrderId,
        refundAmountPaise: Math.round(amountRupees * 100),
        reason: reason.trim(),
      })
      toast.success(t('admin.orders.forceRefundSuccess'))
    } catch {
      toast.error(t('admin.orders.actionFailed'))
    } finally {
      setBusySubOrderId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="order-id-search">{t('admin.orders.orderIdLabel')}</Label>
          <Input id="order-id-search" value={orderIdInput} onChange={(e) => setOrderIdInput(e.target.value)} />
        </div>
        <Button onClick={() => lookup(orderIdInput)} disabled={loading || orderIdInput.trim().length === 0}>
          {t('admin.orders.searchAction')}
        </Button>
      </div>

      {order === null ? (
        <EmptyState title={t('admin.orders.notFoundTitle')} />
      ) : order ? (
        <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm text-ink">{order.id}</p>
              <p className="text-xs text-steel">{new Date(order.placedAt).toLocaleString('en-IN')}</p>
            </div>
            <p className="font-mono text-lg font-semibold text-ink">{formatINR(order.totalPaise)}</p>
          </div>
          <p className="text-sm text-steel">
            {t('admin.orders.currentStatus')}: <span className="font-medium text-ink">{order.status}</span> ·{' '}
            {t('admin.orders.paymentStatus')}: <span className="font-medium text-ink">{order.paymentStatus}</span>
          </p>

          <section className="space-y-2 border-t border-steel/10 pt-3">
            <p className="text-sm font-medium text-ink">{t('admin.orders.forceStatusTitle')}</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px]">
                <Select value={forceStatus} onValueChange={setForceStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.orders.forceStatusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatusSchema.options.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px] flex-1">
                <Input
                  placeholder={t('admin.orders.forceStatusReasonPlaceholder')}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>
              <Button variant="destructive" size="sm" onClick={runForceStatus} disabled={busyStatus || !forceStatus || statusReason.trim().length === 0}>
                {t('admin.orders.applyForceStatus')}
              </Button>
            </div>
          </section>

          <section className="space-y-2 border-t border-steel/10 pt-3">
            <p className="text-sm font-medium text-ink">{t('admin.orders.subOrdersTitle')}</p>
            <ul className="space-y-2">
              {subOrders.map((subOrder) => (
                <li key={subOrder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-steel/10 p-3">
                  <div>
                    <p className="font-mono text-xs text-steel">{subOrder.id}</p>
                    <p className="text-sm text-ink">
                      {subOrder.status} · {formatINR(subOrder.totalPaise)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runForceCancel(subOrder.id)}
                      disabled={busySubOrderId === subOrder.id}
                    >
                      {t('admin.orders.forceCancel')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runForceRefund(subOrder.id)}
                      disabled={busySubOrderId === subOrder.id}
                    >
                      {t('admin.orders.forceRefund')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  )
}
