import type { CartItem } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useListing } from '@/features/catalog/api/listing'

interface SavedForLaterRowProps {
  item: CartItem
  onMoveToCart: () => void
  onRemove: () => void
  disabled?: boolean
}

function SavedForLaterRow({ item, onMoveToCart, onRemove, disabled }: SavedForLaterRowProps) {
  const { t } = useTranslation()
  const listingQuery = useListing(item.listingId)

  return (
    <li className="flex items-center gap-3 py-3">
      {listingQuery.data?.images[0] ? (
        <img src={listingQuery.data.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-[6px] object-cover" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-[6px] bg-surface-muted" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        {listingQuery.isLoading ? (
          <Skeleton className="h-5 w-2/3" />
        ) : (
          <p className="truncate text-sm font-medium text-ink">{listingQuery.data?.title ?? t('cart.itemUnavailable')}</p>
        )}
        <p className="font-mono text-xs text-steel">
          {t('cart.qty', { qty: item.qty })} · {formatINR(item.unitPricePaise)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onMoveToCart}>
          {t('cart.savedForLater.moveToCart')}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          {t('cart.remove')}
        </Button>
      </div>
    </li>
  )
}

interface SavedForLaterListProps {
  items: CartItem[]
  pendingListingIds: Set<string>
  onMoveToCart: (listingId: string) => void
  onRemove: (listingId: string) => void
}

/** "Save for later" shelf (design spec item 8) — kept out of priceCart entirely, so it never contributes to the payable total until a line is moved back. */
export function SavedForLaterList({ items, pendingListingIds, onMoveToCart, onRemove }: SavedForLaterListProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">
        {t('cart.savedForLater.title', { count: items.length })}
      </h2>
      <ul className="divide-y divide-steel/10">
        {items.map((item) => (
          <SavedForLaterRow
            key={item.listingId}
            item={item}
            disabled={pendingListingIds.has(item.listingId)}
            onMoveToCart={() => onMoveToCart(item.listingId)}
            onRemove={() => onRemove(item.listingId)}
          />
        ))}
      </ul>
    </section>
  )
}
