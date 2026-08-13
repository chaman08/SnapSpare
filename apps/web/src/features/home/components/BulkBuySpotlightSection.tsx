import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { RelatedPartsRail } from '@/features/catalog/components/RelatedPartsRail'
import { useBulkBuySpotlightListingIds } from '@/features/home/api/useBulkBuySpotlight'
import { useListingsByIds } from '@/features/home/api/useListingsByIds'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface BulkBuySpotlightSectionProps {
  section: Extract<HomeSection, { type: 'bulk_buy_spotlight' }>
}

/** Design brief item 1's "biggest slab savings" rail — ranked server-side by computeBulkBuySpotlight.ts against every listing's actual pricing ladder, with any admin-pinned listings shown first. */
export function BulkBuySpotlightSection({ section }: BulkBuySpotlightSectionProps) {
  const { t, i18n } = useTranslation()
  const { data: listingIds, isLoading: idsLoading } = useBulkBuySpotlightListingIds(section.pinnedListingIds, section.maxItems)
  const { data: listings, isLoading: listingsLoading } = useListingsByIds(listingIds ?? [])
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.bulkBuySpotlight.title')

  if (idsLoading || listingsLoading) return <Skeleton className="h-64 w-full rounded-[6px]" />

  return <RelatedPartsRail title={title} listings={listings ?? []} />
}
