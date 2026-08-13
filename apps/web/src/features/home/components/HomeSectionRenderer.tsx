import type { HomeSection } from '@snapspare/shared'
import { BrandRailSection } from '@/features/home/components/BrandRailSection'
import { BulkBuySpotlightSection } from '@/features/home/components/BulkBuySpotlightSection'
import { CategoryTilesSection } from '@/features/home/components/CategoryTilesSection'
import { DealOfDaySection } from '@/features/home/components/DealOfDaySection'
import { HeroBannerSection } from '@/features/home/components/HeroBannerSection'
import { RecentlyViewedSection } from '@/features/home/components/RecentlyViewedSection'
import { ReorderRailSection } from '@/features/home/components/ReorderRailSection'
import { TrustStripSection } from '@/features/home/components/TrustStripSection'
import { VehicleSelectorSection } from '@/features/home/components/VehicleSelectorSection'

interface HomeSectionRendererProps {
  section: HomeSection
}

/** Dispatches one admin-configured homeSection doc to its renderer, by `type`. */
export function HomeSectionRenderer({ section }: HomeSectionRendererProps) {
  switch (section.type) {
    case 'hero_banner':
      return <HeroBannerSection section={section} />
    case 'vehicle_selector':
      return <VehicleSelectorSection section={section} />
    case 'category_tiles':
      return <CategoryTilesSection section={section} />
    case 'deal_of_day':
      return <DealOfDaySection section={section} />
    case 'bulk_buy_spotlight':
      return <BulkBuySpotlightSection section={section} />
    case 'brand_rail':
      return <BrandRailSection section={section} />
    case 'recently_viewed':
      return <RecentlyViewedSection section={section} />
    case 'reorder_rail':
      return <ReorderRailSection section={section} />
    case 'trust_strip':
      return <TrustStripSection section={section} />
    default:
      return null
  }
}
