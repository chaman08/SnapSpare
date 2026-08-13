import type { SearchListingDocument } from '@snapspare/shared'
import { buildPartSlugId, formatINR, slugify } from '@snapspare/shared'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { FitmentBadge } from '@/features/catalog/components/FitmentBadge'
import { QuantityStepper } from '@/features/catalog/components/QuantityStepper'
import { track } from '@/lib/analytics/track'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  listing: SearchListingDocument
  className?: string
  /** First visible row of a grid should load its image eagerly instead of lazily — set by the caller, which knows layout position. */
  priorityImage?: boolean
  /** Passed through to a select_item/add_to_cart analytics call so the funnel report can attribute the click back to the list it came from (search results, a category page, a home rail, ...). Optional — omitted calls are still safe, just less attributable. */
  listContext?: { id: string; name: string }
}

const LOW_STOCK_THRESHOLD = 5

/**
 * The core catalog display unit — reused by search results, category browse,
 * and (later) home page rails. Backed by a Typesense search document rather
 * than a raw Listing so every field it renders is already denormalised for
 * display (no per-card Firestore reads for seller rating, part number, etc).
 */
export function ProductCard({ listing, className, priorityImage = false, listContext }: ProductCardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [qty, setQty] = useState(listing.moq)
  const [adding, setAdding] = useState(false)

  const href = `/parts/p/${buildPartSlugId(slugify(listing.title), listing.partId)}`
  const analyticsItem = {
    item_id: listing.partId,
    item_name: listing.title,
    item_category: listing.category,
    item_category2: listing.subCategory || undefined,
    item_brand: listing.brand || undefined,
    item_list_id: listContext?.id,
    item_list_name: listContext?.name,
    price: listing.basePricePaise / 100,
  }
  const discountPercent =
    listing.mrpPaise && listing.mrpPaise > listing.basePricePaise
      ? Math.round((1 - listing.basePricePaise / listing.mrpPaise) * 100)
      : undefined
  const outOfStock = listing.stockQty === 0
  const lowStock = !outOfStock && listing.stockQty <= LOW_STOCK_THRESHOLD

  async function handleAddToCart() {
    setAdding(true)
    try {
      await addItemToCart(user?.uid, {
        listingId: listing.listingId,
        partId: listing.partId,
        sellerId: listing.sellerId,
        qty,
        unitPricePaise: listing.basePricePaise,
        tierMinQtyApplied: listing.moq,
      })
      track('add_to_cart', {
        currency: 'INR',
        value: (listing.basePricePaise / 100) * qty,
        items: [{ ...analyticsItem, quantity: qty }],
      })
      toast.success(t('product.addedToCart'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setAdding(false)
    }
  }

  function handleSelect() {
    if (listContext) track('select_item', { item_list_id: listContext.id, item_list_name: listContext.name, items: [analyticsItem] })
  }

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-[6px] border border-steel/20 bg-surface', className)}>
      <Link to={href} onClick={handleSelect} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
        {listing.imageUrl ? (
          <ResponsiveImage
            src={listing.imageUrl}
            alt=""
            width={400}
            height={400}
            priority={priorityImage}
            wrapperClassName="bg-surface-muted"
          />
        ) : (
          <div className="aspect-square w-full bg-surface-muted" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <FitmentBadge partId={listing.partId} size="sm" />

        <Link to={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
          {listing.brand ? <p className="text-xs font-medium text-steel">{listing.brand}</p> : null}
          <p className="line-clamp-2 text-sm font-medium text-ink">{listing.title}</p>
        </Link>

        {listing.partNumber ? (
          <p className="truncate font-mono text-xs text-steel">{listing.partNumber}</p>
        ) : null}

        <div className="flex items-baseline gap-2">
          <span className="font-heading text-lg font-semibold text-ink">{formatINR(listing.basePricePaise)}</span>
          {listing.mrpPaise ? (
            <span className="text-xs text-steel line-through">{formatINR(listing.mrpPaise)}</span>
          ) : null}
          {discountPercent ? (
            <span className="text-xs font-semibold text-signal">{t('product.discountPercent', { percent: discountPercent })}</span>
          ) : null}
        </div>

        {listing.bulkMinQty ? (
          <p className="text-xs text-verify">
            {t('product.slabHint', { price: formatINR(listing.minPricePaise), qty: listing.bulkMinQty })}
          </p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-steel">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-signal text-signal" aria-hidden="true" />
            {listing.maxRating > 0 ? listing.maxRating.toFixed(1) : t('product.newSeller')}
          </span>
          <span>{t('product.deliveryEta', { count: listing.deliveryEtaDays })}</span>
        </div>

        {outOfStock ? (
          <p className="text-xs font-medium text-alert">{t('product.outOfStock')}</p>
        ) : lowStock ? (
          <p className="text-xs font-medium text-alert">{t('product.lowStock', { count: listing.stockQty })}</p>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <QuantityStepper
            qty={qty}
            min={listing.moq}
            max={outOfStock ? listing.moq : listing.stockQty}
            onChange={setQty}
          />
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="flex-1"
            disabled={outOfStock || adding}
            onClick={handleAddToCart}
          >
            {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
          </Button>
        </div>
      </div>
    </div>
  )
}
