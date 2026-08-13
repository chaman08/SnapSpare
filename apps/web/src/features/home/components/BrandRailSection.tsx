import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { useBrandsByIds } from '@/features/home/api/useBrandsByIds'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface BrandRailSectionProps {
  section: Extract<HomeSection, { type: 'brand_rail' }>
}

/**
 * Design brief item 1's brand rail. Links into the existing free-text search
 * (`/search?q=<brand name>`) rather than a dedicated brand filter param —
 * SearchResultsPage/useSearchListings only reads `q`/`makeId` today, and
 * `brand` is already one of the weighted `query_by` fields, so this reuses a
 * working path instead of introducing a filter no page consumes yet.
 */
export function BrandRailSection({ section }: BrandRailSectionProps) {
  const { t, i18n } = useTranslation()
  const { data: brands, isLoading } = useBrandsByIds(section.brandIds)
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.brandRail.title')

  if (isLoading) return <Skeleton className="h-24 w-full rounded-[6px]" />
  if (!brands || brands.length === 0) return null

  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-heading text-xl font-semibold text-ink">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            to={`/search?q=${encodeURIComponent(brand.name)}`}
            className="flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-[6px] border border-steel/20 bg-surface p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {brand.logoUrl ? (
              <ResponsiveImage
                src={brand.logoUrl}
                alt=""
                width={40}
                height={40}
                sizes="40px"
                className="object-contain"
                wrapperClassName="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink" aria-hidden="true">
                {brand.name.slice(0, 1)}
              </span>
            )}
            <span className="line-clamp-2 text-xs font-medium text-ink">{brand.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
