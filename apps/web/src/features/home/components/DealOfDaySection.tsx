import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { useListingsByIds } from '@/features/home/api/useListingsByIds'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface DealOfDaySectionProps {
  section: Extract<HomeSection, { type: 'deal_of_day' }>
}

/** Design brief item 1's deal-of-the-day — a single admin-picked listing, live only within its `startAt`/`endAt` window. Renders nothing outside that window or once the listing drops out of the (active, in-stock) search index. */
export function DealOfDaySection({ section }: DealOfDaySectionProps) {
  const { t, i18n } = useTranslation()
  const now = Date.now()
  const isLive = now >= section.startAt && now <= section.endAt
  const { data: listings, isLoading } = useListingsByIds(isLive ? [section.listingId] : [])
  const listing = listings?.[0]
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.dealOfDay.title')
  const badge = pickLocalizedText(section.badgeLabel, i18n.language) ?? t('home.dealOfDay.badge')

  if (!isLive) return null
  if (isLoading) return <Skeleton className="h-72 w-full max-w-xs rounded-[6px]" />
  if (!listing) return null

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-xl font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-signal/10 px-2 py-0.5 text-xs font-semibold text-signal">{badge}</span>
      </div>
      <ProductCard listing={listing} className="max-w-xs" />
    </section>
  )
}
