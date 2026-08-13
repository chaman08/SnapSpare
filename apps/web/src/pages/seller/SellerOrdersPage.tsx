import type { Return, SubOrder, SubOrderStatus } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VariableVirtualList } from '@/components/virtual/VariableVirtualList'
import { useAuth } from '@/features/auth/api/AuthProvider'
import {
  acceptSubOrder,
  bulkAcceptSubOrders,
  mapSubOrderActionErrorToI18nKey,
  packSubOrder,
  refundReturn,
  rejectSubOrder,
  updateShipmentStatus,
} from '@/features/orders/api/subOrderActions'
import { getCreditNoteUrl, mapTaxActionErrorToI18nKey } from '@/features/orders/api/taxActions'
import { InvoiceDownloadButton } from '@/features/orders/components/InvoiceDownloadButton'
import { BookShipmentPanel } from '@/features/seller/components/BookShipmentPanel'
import { PackingSlipPrintSheet } from '@/features/seller/components/PackingSlipPrintSheet'
import { ShipSubOrderForm } from '@/features/seller/components/ShipSubOrderForm'
import { decideReturn } from '@/features/seller/api/returnActions'
import { ReturnQcForm } from '@/features/seller/components/ReturnQcForm'
import { useSellerReturns } from '@/features/seller/api/useSellerReturns'
import { useSellerSubOrders } from '@/features/seller/api/useSellerSubOrders'

type TabKey = 'new' | 'toPack' | 'toShip' | 'shipped' | 'delivered' | 'cancelled' | 'returns'

const TAB_STATUSES: Record<Exclude<TabKey, 'returns'>, SubOrderStatus[]> = {
  new: ['pending'],
  toPack: ['accepted'],
  toShip: ['packed'],
  shipped: ['shipped', 'out_for_delivery'],
  delivered: ['delivered'],
  cancelled: ['cancelled', 'rejected'],
}

const TAB_ORDER: TabKey[] = ['new', 'toPack', 'toShip', 'shipped', 'delivered', 'cancelled', 'returns']

export default function SellerOrdersPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const [tab, setTab] = useState<TabKey>('new')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [shippingSubOrderId, setShippingSubOrderId] = useState<string | null>(null)
  const [printBatch, setPrintBatch] = useState<SubOrder[] | null>(null)
  const [busySubOrderId, setBusySubOrderId] = useState<string | null>(null)

  const { subOrders, loading } = useSellerSubOrders(sellerId, tab === 'returns' ? [] : TAB_STATUSES[tab])
  const { returns, loading: returnsLoading } = useSellerReturns(tab === 'returns' ? sellerId : undefined)

  useEffect(() => {
    setSelected(new Set())
  }, [tab])

  useEffect(() => {
    if (!printBatch) return
    const timeout = window.setTimeout(() => {
      window.print()
      setPrintBatch(null)
    }, 50)
    return () => window.clearTimeout(timeout)
  }, [printBatch])

  const selectableTab = tab === 'new' || tab === 'toPack' || tab === 'toShip'

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkAccept() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    try {
      const result = await bulkAcceptSubOrders(ids)
      if (result.accepted.length > 0) toast.success(t('sellerOrders.bulkAccept.success', { count: result.accepted.length }))
      if (result.failed.length > 0) toast.error(t('sellerOrders.bulkAccept.partialFailure', { count: result.failed.length }))
      setSelected(new Set())
    } catch {
      toast.error(t('sellerOrders.bulkAccept.failure'))
    }
  }

  function handlePrintSelected() {
    const batch = subOrders.filter((subOrder) => selected.has(subOrder.id))
    if (batch.length === 0) return
    setPrintBatch(batch)
  }

  async function handleAction(id: string, action: () => Promise<unknown>) {
    setBusySubOrderId(id)
    try {
      await action()
    } catch (error) {
      toast.error(t(mapSubOrderActionErrorToI18nKey(error)))
    } finally {
      setBusySubOrderId(null)
    }
  }

  const returnsByStatus = useMemo(() => {
    const requested = returns.filter((r) => r.status === 'requested')
    const approved = returns.filter((r) => r.status === 'approved')
    const disputed = returns.filter((r) => r.status === 'qc_disputed')
    const resolved = returns.filter((r) =>
      ['refunded', 'replaced', 'rejected', 'closed', 'picked_up', 'qc_passed'].includes(r.status),
    )
    return { requested, approved, disputed, resolved }
  }, [returns])

  return (
    <div className="print:hidden">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerOrders.title')}</h1>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <TabsList aria-label={t('sellerOrders.title')}>
            {TAB_ORDER.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`sellerOrders.tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {selectableTab ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-steel">{t('sellerOrders.selectedCount', { count: selected.size })}</span>
            {tab === 'new' ? (
              <Button type="button" variant="cta" size="sm" disabled={selected.size === 0} onClick={handleBulkAccept}>
                {t('sellerOrders.bulkAccept.action')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" disabled={selected.size === 0} onClick={handlePrintSelected}>
              {t('sellerOrders.printSelected')}
            </Button>
          </div>
        ) : null}

        {tab === 'returns' ? (
          returnsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : returns.length === 0 ? (
            <EmptyState title={t('sellerOrders.returns.emptyTitle')} />
          ) : (
            <ReturnsList
              requested={returnsByStatus.requested}
              approved={returnsByStatus.approved}
              disputed={returnsByStatus.disputed}
              resolved={returnsByStatus.resolved}
              busyId={busySubOrderId}
              onDecision={(ret, decision) => handleAction(ret.id, () => decideReturn({ returnId: ret.id, decision }))}
              onRefund={(ret) => handleAction(ret.id, () => refundReturn(ret.id))}
            />
          )
        ) : loading ? (
          <Skeleton className="h-24 w-full" />
        ) : subOrders.length === 0 ? (
          <EmptyState title={t('sellerOrders.emptyTitle')} description={t('sellerOrders.emptyDescription')} />
        ) : (
          <VariableVirtualList
            items={subOrders}
            getItemKey={(subOrder) => subOrder.id}
            estimatedItemHeight={220}
            height={900}
            renderItem={(subOrder) => (
              <SubOrderRow
                subOrder={subOrder}
                tab={tab}
                selectableTab={selectableTab}
                selected={selected.has(subOrder.id)}
                onToggleSelected={() => toggleSelected(subOrder.id)}
                busy={busySubOrderId === subOrder.id}
                shipping={shippingSubOrderId === subOrder.id}
                onStartShipping={() => setShippingSubOrderId(subOrder.id)}
                onStopShipping={() => setShippingSubOrderId(null)}
                onAccept={() => handleAction(subOrder.id, () => acceptSubOrder(subOrder.id))}
                onReject={() => handleAction(subOrder.id, () => rejectSubOrder(subOrder.id))}
                onPack={() => handleAction(subOrder.id, () => packSubOrder(subOrder.id))}
                onMarkOutForDelivery={() =>
                  handleAction(subOrder.id, () => updateShipmentStatus({ subOrderId: subOrder.id, status: 'out_for_delivery' }))
                }
                onMarkDelivered={() =>
                  handleAction(subOrder.id, () => updateShipmentStatus({ subOrderId: subOrder.id, status: 'delivered' }))
                }
              />
            )}
          />
        )}
      </div>

      {printBatch ? <PackingSlipPrintSheet subOrders={printBatch} /> : null}
    </div>
  )
}

interface SubOrderRowProps {
  subOrder: SubOrder
  tab: TabKey
  selectableTab: boolean
  selected: boolean
  onToggleSelected: () => void
  busy: boolean
  shipping: boolean
  onStartShipping: () => void
  onStopShipping: () => void
  onAccept: () => void
  onReject: () => void
  onPack: () => void
  onMarkOutForDelivery: () => void
  onMarkDelivered: () => void
}

/**
 * One seller order row — extracted so it can be shared between the plain
 * (`<= virtualizeThreshold` items) and windowed (react-window) rendering
 * paths inside VariableVirtualList without duplicating this markup.
 */
function SubOrderRow({
  subOrder,
  tab,
  selectableTab,
  selected,
  onToggleSelected,
  busy,
  shipping,
  onStartShipping,
  onStopShipping,
  onAccept,
  onReject,
  onPack,
  onMarkOutForDelivery,
  onMarkDelivered,
}: SubOrderRowProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-[6px] border border-steel/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {selectableTab ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              aria-label={t('sellerOrders.selectRow')}
              className="mt-1 h-5 w-5"
            />
          ) : null}
          <div>
            <p className="font-mono text-sm text-ink">{subOrder.id}</p>
            <p className="text-xs text-steel">
              {t('orders.orderId')}: <span className="font-mono">{subOrder.orderId}</span>
            </p>
            <p className="text-xs text-steel">{subOrder.shippingAddress.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subOrder.shipment?.ndr ? (
            <span className="rounded-full bg-alert/10 px-2 py-0.5 text-xs font-medium text-alert">
              {t(`orders.ndr.status.${subOrder.shipment.ndr.status}`)}
              {subOrder.shipment.ndr.attempts > 1 ? ` (${subOrder.shipment.ndr.attempts})` : ''}
            </span>
          ) : null}
          <span className="font-mono text-ink">{formatINR(subOrder.totalPaise)}</span>
        </div>
      </div>

      <ul className="mt-2 space-y-1">
        {subOrder.items.map((item) => (
          <li key={item.listingId} className="flex items-center justify-between text-sm text-steel">
            <span className="truncate">
              {item.title} × {item.qty}
            </span>
            <span className="shrink-0 font-mono text-ink">{item.sku}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-steel/10 pt-3">
        {tab === 'new' ? (
          <>
            <Button type="button" variant="cta" size="sm" disabled={busy} onClick={onAccept}>
              {t('sellerOrders.actions.accept')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReject}>
              {t('sellerOrders.actions.reject')}
            </Button>
          </>
        ) : null}

        {tab === 'toPack' ? (
          <Button type="button" variant="cta" size="sm" disabled={busy} onClick={onPack}>
            {t('sellerOrders.actions.pack')}
          </Button>
        ) : null}

        {tab === 'toShip' && !shipping ? (
          <Button type="button" variant="cta" size="sm" onClick={onStartShipping}>
            {t('sellerOrders.actions.ship')}
          </Button>
        ) : null}

        {tab === 'shipped' && subOrder.status === 'shipped' ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onMarkOutForDelivery}>
            {t('sellerOrders.actions.markOutForDelivery')}
          </Button>
        ) : null}

        {tab === 'shipped' && subOrder.status === 'out_for_delivery' ? (
          <Button type="button" variant="cta" size="sm" disabled={busy} onClick={onMarkDelivered}>
            {t('sellerOrders.actions.markDelivered')}
          </Button>
        ) : null}

        {subOrder.invoiceNumber ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-steel">{subOrder.invoiceNumber}</span>
            <InvoiceDownloadButton subOrderId={subOrder.id} />
          </div>
        ) : null}
      </div>

      {tab === 'toShip' ? (
        <div className="mt-3">
          <BookShipmentPanel subOrder={subOrder} />
        </div>
      ) : null}

      {tab === 'toShip' && shipping ? (
        <div className="mt-3">
          <ShipSubOrderForm subOrderId={subOrder.id} onShipped={onStopShipping} onCancel={onStopShipping} />
        </div>
      ) : null}
    </div>
  )
}

interface ReturnsListProps {
  requested: Return[]
  approved: Return[]
  disputed: Return[]
  resolved: Return[]
  busyId: string | null
  onDecision: (ret: Return, decision: 'approved' | 'rejected') => void
  onRefund: (ret: Return) => void
}

function ReturnsList({ requested, approved, disputed, resolved, busyId, onDecision, onRefund }: ReturnsListProps) {
  const { t } = useTranslation()
  const [qcOpenFor, setQcOpenFor] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {[...requested, ...approved, ...disputed, ...resolved].length === 0 ? null : (
        <ul className="space-y-3">
          {requested.map((ret) => (
            <li key={ret.id} className="rounded-[6px] border border-steel/20 p-4">
              <ReturnRowHeader ret={ret} />
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="cta" size="sm" disabled={busyId === ret.id} onClick={() => onDecision(ret, 'approved')}>
                  {t('sellerOrders.returns.approve')}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busyId === ret.id} onClick={() => onDecision(ret, 'rejected')}>
                  {t('sellerOrders.returns.reject')}
                </Button>
              </div>
            </li>
          ))}
          {approved.map((ret) => (
            <li key={ret.id} className="rounded-[6px] border border-steel/20 p-4">
              <ReturnRowHeader ret={ret} />
              {ret.pickup?.awb ? (
                <p className="mt-1 font-mono text-xs text-steel">
                  {t('sellerOrders.returns.pickupAwb')}: {ret.pickup.awb}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {qcOpenFor !== ret.id ? (
                  <Button type="button" variant="cta" size="sm" onClick={() => setQcOpenFor(ret.id)}>
                    {t('sellerOrders.returns.qc.action')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" disabled={busyId === ret.id} onClick={() => onRefund(ret)}>
                  {t('sellerOrders.returns.markRefunded')}
                </Button>
              </div>
              {qcOpenFor === ret.id ? <ReturnQcForm returnId={ret.id} onDone={() => setQcOpenFor(null)} /> : null}
            </li>
          ))}
          {disputed.map((ret) => (
            <li key={ret.id} className="rounded-[6px] border border-alert/30 bg-alert/5 p-4">
              <ReturnRowHeader ret={ret} />
              <p className="mt-2 text-sm text-alert">{t('sellerOrders.returns.qcDisputedNote')}</p>
            </li>
          ))}
          {resolved.map((ret) => (
            <li key={ret.id} className="rounded-[6px] border border-steel/20 p-4 opacity-70">
              <ReturnRowHeader ret={ret} />
              {ret.creditNoteId ? <CreditNoteDownloadButton creditNoteId={ret.creditNoteId} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreditNoteDownloadButton({ creditNoteId }: { creditNoteId: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const result = await getCreditNoteUrl(creditNoteId)
      window.open(result.creditNoteUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(t(mapTaxActionErrorToI18nKey(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleClick}>
        {loading ? t('common.loading') : t('orders.tax.downloadCreditNote')}
      </Button>
    </div>
  )
}

function ReturnRowHeader({ ret }: { ret: Return }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-mono text-sm text-ink">{ret.subOrderId}</p>
        <p className="text-xs text-steel">{t(`orders.return.reasons.${ret.reason}`)}</p>
      </div>
      <span className="rounded-[6px] bg-steel/10 px-2.5 py-1 text-xs font-medium text-steel">
        {t(`sellerOrders.returns.status.${ret.status}`)}
      </span>
    </div>
  )
}
