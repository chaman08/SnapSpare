import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface CategoryTilesSectionProps {
  section: Extract<HomeSection, { type: 'category_tiles' }>
}

/** Design brief item 1's category-tiles rail — admin-picked slugs/images/labels, one tile per category. */
export function CategoryTilesSection({ section }: CategoryTilesSectionProps) {
  const { t, i18n } = useTranslation()
  const title = pickLocalizedText(section.title, i18n.language)

  return (
    <section aria-label={title ?? t('home.categoryTiles.title')}>
      {title ? <h2 className="mb-3 font-heading text-xl font-semibold text-ink">{title}</h2> : null}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {section.items.map((item) => (
          <Link
            key={item.categorySlug}
            to={`/parts/${item.categorySlug}`}
            className="flex flex-col items-center gap-1.5 rounded-[6px] p-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <ResponsiveImage
              src={item.imageUrl}
              alt=""
              width={200}
              height={200}
              sizes="(min-width: 768px) 16vw, 33vw"
              wrapperClassName="rounded-[6px] border border-steel/20 bg-surface-muted"
            />
            <span className="line-clamp-2 text-xs font-medium text-ink">{pickLocalizedText(item.label, i18n.language)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
