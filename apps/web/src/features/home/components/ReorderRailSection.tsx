import type { HomeSection } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { reorderSubOrder } from '@/features/orders/api/reorder'
import { useReorderRail } from '@/features/home/api/useReorderRail'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface ReorderRailSectionProps {
  section: Extract<HomeSection, { type: 'reorder_rail' }>
}

/** Design brief item 1's reorder rail for returning buyers — one card per recently-delivered sub-order, reusing the same re-price-before-adding reorder flow as the order-history page. */
export function ReorderRailSection({ section }: ReorderRailSectionProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: subOrders, isLoading } = useReorderRail(user?.uid, section.maxItems)
  const [reorderingId, setReorderingId] = useState<string | undefined>(undefined)
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.reorderRail.title')

  async function handleReorder(subOrderId: string) {
    const subOrder = subOrders?.find((s) => s.id === subOrderId)
    if (!subOrder) return
    setReorderingId(subOrderId)
    try {
      const outcome = await reorderSubOrder(user?.uid, subOrder)
      if (outcome.addedCount > 0) {
        toast.success(t('orders.reorder.success', { count: outcome.addedCount }))
        navigate('/cart')
      }
      if (outcome.changedItems.length > 0) {
        toast.warning(t('orders.reorder.changedWarning', { count: outcome.changedItems.length }))
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setReorderingId(undefined)
    }
  }

  if (!user) return null
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[6px]" />
  if (!subOrders || subOrders.length === 0) return null

  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-heading text-xl font-semibold text-ink">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {subOrders.map((subOrder) => {
          const firstItem = subOrder.items[0]
          const extraCount = subOrder.items.length - 1
          return (
            <div key={subOrder.id} className="flex w-56 shrink-0 flex-col gap-2 rounded-[6px] border border-steel/20 bg-surface p-3">
              <p className="line-clamp-2 text-sm font-medium text-ink">
                {firstItem?.title}
                {extraCount > 0 ? t('home.reorderRail.andMore', { count: extraCount }) : ''}
              </p>
              <p className="text-sm text-steel">{formatINR(subOrder.totalPaise)}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleReorder(subOrder.id)}
                disabled={reorderingId === subOrder.id}
              >
                {t('orders.reorder.action')}
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
