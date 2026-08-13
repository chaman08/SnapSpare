import { CANCELLABLE_SUB_ORDER_STATUSES, formatINR } from '@snapspare/shared'
import { Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'
import { payWithRazorpay } from '@/features/checkout/lib/payWithRazorpay'
import { CancelSubOrderAction } from '@/features/orders/components/CancelSubOrderAction'
import { NdrBanner } from '@/features/orders/components/NdrBanner'
import { NeedHelpButton } from '@/features/orders/components/NeedHelpButton'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import { OpenDisputeButton } from '@/features/orders/components/OpenDisputeButton'
import { RequestReturnForm } from '@/features/orders/components/RequestReturnForm'
import { ReviewForm } from '@/features/orders/components/ReviewForm'
import { SubmitWarrantyClaimForm } from '@/features/orders/components/SubmitWarrantyClaimForm'
import { useBuyerReturnsForOrder, useBuyerWarrantyClaimsForOrder } from '@/features/orders/api/useBuyerPostSaleForOrder'
import { useOrder } from '@/features/orders/api/useOrder'
import { PushPermissionPrompt } from '@/features/notifications/components/PushPermissionPrompt'
import { ReportSpuriousPartDialog } from '@/features/trust/components/ReportSpuriousPartDialog'
import { cn } from '@/lib/utils'

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-alert/10 text-alert',
  placed: 'bg-steel/10 text-steel',
  confirmed: 'bg-verify/10 text-verify',
  processing: 'bg-verify/10 text-verify',
  partially_shipped: 'bg-signal/10 text-signal',
  shipped: 'bg-signal/10 text-signal',
  delivered: 'bg-verify/10 text-verify',
  completed: 'bg-verify/10 text-verify',
  cancelled: 'bg-alert/10 text-alert',
  refunded: 'bg-steel/10 text-steel',
}

const RETURN_WINDOW_FALLBACK_DAYS = 7

/**
 * Order confirmation + detail screen. Per-seller sub-orders each get their
 * own vertical timeline, AWB (monospace, copyable, with a track-out link),
 * per-item breakdown, and cancel/return actions gated by the subOrder's
 * current status and — for returns — a rough client-side return-window
 * check (requestReturn re-validates the real window server-side against the
 * listing's own returnWindowDays, so this is just to avoid showing a button
 * that would obviously fail).
 */
export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { order, subOrders, loading, error } = useOrder(orderId)
  const { config } = useAppConfig()
  const [resuming, setResuming] = useState(false)
  const [returningSubOrderId, setReturningSubOrderId] = useState<string | null>(null)
  const [reviewingListingId, setReviewingListingId] = useState<string | null>(null)
  const [reportingListingId, setReportingListingId] = useState<string | null>(null)
  const [claimingListingId, setClaimingListingId] = useState<string | null>(null)
  const buyerReturns = useBuyerReturnsForOrder(order?.id, user?.uid)
  const buyerWarrantyClaims = useBuyerWarrantyClaimsForOrder(order?.id, user?.uid)

  async function handleResumePayment() {
    if (!order?.razorpayOrderId || !config?.razorpayKeyId) return
    setResuming(true)
    try {
      const result = await payWithRazorpay({
        orderId: order.id,
        razorpayOrderId: order.razorpayOrderId,
        amountPaise: order.totalPaise,
        keyId: config.razorpayKeyId,
        buyerName: profile?.displayName,
        buyerPhone: profile?.phone,
        buyerEmail: profile?.email,
        emiEnabled: config.emiThresholdPaise !== undefined && order.totalPaise >= config.emiThresholdPaise,
      })
      if (result.status !== 'confirmed') {
        toast.error(t('checkout.errors.paymentNotCompleted'))
      }
    } catch {
      toast.error(t('checkout.errors.paymentNotCompleted'))
    } finally {
      setResuming(false)
    }
  }

  function copyAwb(awb: string) {
    void navigator.clipboard.writeText(awb).then(
      () => toast.success(t('orders.awbCopied')),
      () => undefined,
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (!order || order.buyerId !== user?.uid) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState
          title={t('orders.notFoundTitle')}
          actionLabel={t('orders.viewAllOrders')}
          onAction={() => navigate('/orders')}
        />
      </div>
    )
  }

  const justPlaced = searchParams.get('placed') === '1'
  const returnWindowDays = config?.defaultReturnWindowDays ?? RETURN_WINDOW_FALLBACK_DAYS

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      {justPlaced ? (
        <>
          <div className="rounded-[6px] bg-verify/10 p-4">
            <p className="font-heading text-lg font-semibold text-verify">{t('checkout.confirmation.title')}</p>
            <p className="text-sm text-verify">{t('checkout.confirmation.description')}</p>
          </div>
          <PushPermissionPrompt />
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-steel">{t('orders.orderId')}</p>
          <p className="font-mono text-lg text-ink">{order.id}</p>
        </div>
        <span
          className={cn(
            'rounded-[6px] px-3 py-1 text-sm font-medium',
            ORDER_STATUS_STYLES[order.status] ?? 'bg-steel/10 text-steel',
          )}
        >
          {t(`orders.status.${order.status}`)}
        </span>
      </div>

      {order.status === 'pending_payment' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-alert/30 bg-alert/5 p-4">
          <p className="text-sm text-alert">{t('orders.pendingPaymentNotice')}</p>
          <Button
            type="button"
            variant="cta"
            size="sm"
            onClick={handleResumePayment}
            disabled={resuming || !order.razorpayOrderId}
          >
            {resuming ? t('common.loading') : t('orders.resumePayment')}
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {subOrders.map((subOrder) => {
          const deliveredAt = subOrder.shipment?.deliveredAt
          const withinReturnWindow =
            subOrder.status === 'delivered' &&
            deliveredAt !== undefined &&
            Date.now() - deliveredAt <= returnWindowDays * 24 * 60 * 60_000
          const isCancellable = CANCELLABLE_SUB_ORDER_STATUSES.includes(subOrder.status)

          return (
            <div key={subOrder.id} className="space-y-3 rounded-[6px] border border-steel/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">{t(`orders.subOrderStatus.${subOrder.status}`)}</p>
                {subOrder.etaDaysMin !== undefined && subOrder.etaDaysMax !== undefined ? (
                  <p className="text-sm text-steel">
                    {t('cart.deliveryEtaRange', { min: subOrder.etaDaysMin, max: subOrder.etaDaysMax })}
                  </p>
                ) : null}
              </div>

              {subOrder.shipment?.awb ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-steel">
                  <span>{t('orders.awb')}:</span>
                  <span className="font-mono text-ink">{subOrder.shipment.awb}</span>
                  <button
                    type="button"
                    onClick={() => copyAwb(subOrder.shipment?.awb ?? '')}
                    className="inline-flex items-center gap-1 rounded-[6px] p-1 text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    aria-label={t('orders.copyAwb')}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`track ${subOrder.shipment.courier ?? ''} ${subOrder.shipment.awb}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-signal underline underline-offset-2"
                  >
                    {t('orders.trackLink')}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              ) : null}

              {subOrder.shipment?.ndr ? <NdrBanner subOrder={subOrder} /> : null}

              {subOrder.timeline.length > 0 ? (
                <OrderTimeline entries={subOrder.timeline} statusI18nPrefix="orders.subOrderStatus" />
              ) : null}

              <ul className="space-y-2">
                {subOrder.items.map((item) => {
                  const itemReturn = buyerReturns.find(
                    (r) => r.subOrderId === subOrder.id && r.listingId === item.listingId,
                  )
                  const itemClaim = buyerWarrantyClaims.find(
                    (c) => c.subOrderId === subOrder.id && c.listingId === item.listingId,
                  )
                  return (
                  <li key={item.listingId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm text-steel">
                      <span className="truncate">
                        {item.title} × {item.qty}
                      </span>
                      <span className="shrink-0 font-mono text-ink">{formatINR(item.lineTotalPaise)}</span>
                    </div>

                    {itemReturn ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[6px] bg-steel/10 px-2 py-0.5 text-xs font-medium text-steel">
                          {t('orders.return.status', { status: t(`sellerOrders.returns.status.${itemReturn.status}`) })}
                        </span>
                        {itemReturn.status === 'qc_disputed' ? (
                          <OpenDisputeButton
                            type="return_qc"
                            orderId={order.id}
                            subOrderId={subOrder.id}
                            returnId={itemReturn.id}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {itemClaim ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[6px] bg-steel/10 px-2 py-0.5 text-xs font-medium text-steel">
                          {t('orders.warranty.status', { status: t(`orders.warranty.claimStatus.${itemClaim.status}`) })}
                        </span>
                        {itemClaim.status === 'rejected' || itemClaim.status === 'escalated_to_brand' ? (
                          <OpenDisputeButton
                            type="warranty_claim"
                            orderId={order.id}
                            subOrderId={subOrder.id}
                            warrantyClaimId={itemClaim.id}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {subOrder.status === 'delivered' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewingListingId(reviewingListingId === item.listingId ? null : item.listingId)}
                        >
                          {t('reviews.form.action')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReportingListingId(item.listingId)}
                        >
                          {t('trust.spuriousReport.action')}
                        </Button>
                        {!itemClaim ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setClaimingListingId(claimingListingId === item.listingId ? null : item.listingId)}
                          >
                            {t('orders.warranty.action')}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {reviewingListingId === item.listingId && user ? (
                      <ReviewForm
                        orderId={order.id}
                        subOrderId={subOrder.id}
                        sellerId={subOrder.sellerId}
                        buyerId={user.uid}
                        buyerDisplayName={profile?.displayName?.split(' ')[0]}
                        item={item}
                        onSubmitted={() => setReviewingListingId(null)}
                        onCancel={() => setReviewingListingId(null)}
                      />
                    ) : null}
                    {reportingListingId === item.listingId ? (
                      <ReportSpuriousPartDialog
                        orderId={order.id}
                        subOrderId={subOrder.id}
                        listingId={item.listingId}
                        partId={item.partId}
                        sellerId={subOrder.sellerId}
                        onClose={() => setReportingListingId(null)}
                      />
                    ) : null}
                    {claimingListingId === item.listingId ? (
                      <SubmitWarrantyClaimForm
                        subOrder={subOrder}
                        listingId={item.listingId}
                        onSubmitted={() => setClaimingListingId(null)}
                        onCancel={() => setClaimingListingId(null)}
                      />
                    ) : null}
                  </li>
                  )
                })}
              </ul>

              <div className="flex items-center justify-between border-t border-steel/10 pt-2 text-sm">
                <span className="text-steel">{t('cart.summary.total')}</span>
                <span className="font-mono font-semibold text-ink">{formatINR(subOrder.totalPaise)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-steel/10 pt-3">
                {isCancellable ? (
                  <CancelSubOrderAction subOrderId={subOrder.id} onCancelled={() => undefined} />
                ) : null}
                {withinReturnWindow && returningSubOrderId !== subOrder.id ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setReturningSubOrderId(subOrder.id)}>
                    {t('orders.return.action')}
                  </Button>
                ) : null}
                <NeedHelpButton orderId={order.id} subOrderId={subOrder.id} />
              </div>

              {returningSubOrderId === subOrder.id ? (
                <RequestReturnForm
                  subOrder={subOrder}
                  onRequested={() => setReturningSubOrderId(null)}
                  onCancel={() => setReturningSubOrderId(null)}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="rounded-[6px] border border-steel/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink">{t('orders.orderTotal')}</span>
          <span className="font-mono text-lg font-semibold text-ink">{formatINR(order.totalPaise)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!subOrders.some((subOrder) => subOrder.invoiceUrl)}
          onClick={() => {
            const invoiceUrl = subOrders.find((subOrder) => subOrder.invoiceUrl)?.invoiceUrl
            if (invoiceUrl) window.open(invoiceUrl, '_blank', 'noopener,noreferrer')
          }}
        >
          {t('orders.downloadInvoice')}
        </Button>
        <Button type="button" variant="cta" onClick={() => navigate('/')}>
          {t('checkout.continueShopping')}
        </Button>
      </div>
    </div>
  )
}
