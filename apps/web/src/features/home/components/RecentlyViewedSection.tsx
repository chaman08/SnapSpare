import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { RelatedPartsRail } from '@/features/catalog/components/RelatedPartsRail'
import { useListingsByIds } from '@/features/home/api/useListingsByIds'
import { pickLocalizedText } from '@/features/home/lib/localizedText'
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore'

interface RecentlyViewedSectionProps {
  section: Extract<HomeSection, { type: 'recently_viewed' }>
}

/** Design brief item 1's recently-viewed rail — sourced from the buyer's own local view history (recentlyViewedStore.ts), never server-side, so it's available even signed out. Renders nothing for a first-time visitor. */
export function RecentlyViewedSection({ section }: RecentlyViewedSectionProps) {
  const { t, i18n } = useTranslation()
  const listingIds = useRecentlyViewedStore((state) => state.listingIds).slice(0, section.maxItems)
  const { data: listings } = useListingsByIds(listingIds)
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.recentlyViewed.title')

  return <RelatedPartsRail title={title} listings={listings ?? []} />
}
