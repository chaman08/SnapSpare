import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveBanners } from '@/features/home/api/useActiveBanners'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface HeroBannerSectionProps {
  section: Extract<HomeSection, { type: 'hero_banner' }>
}

/** Renders the existing `banners` collection's `home_hero` slot — the top-ranked active banner by `sortOrder` gets the hero spot. */
export function HeroBannerSection({ section }: HeroBannerSectionProps) {
  const { i18n } = useTranslation()
  const { banners, loading } = useActiveBanners('home_hero')
  const banner = banners[0]
  const sectionTitle = pickLocalizedText(section.title, i18n.language)

  if (loading) return <Skeleton className="h-48 w-full rounded-[6px] sm:h-64" />
  if (!banner) return null

  const bannerTitle = pickLocalizedText(banner.title, i18n.language) ?? ''
  const image = <img src={banner.imageUrl} alt={bannerTitle} className="h-48 w-full rounded-[6px] object-cover sm:h-64" />

  return (
    <section aria-label={sectionTitle ?? bannerTitle}>
      {banner.linkUrl ? (
        <a href={banner.linkUrl} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
          {image}
        </a>
      ) : (
        image
      )}
    </section>
  )
}
