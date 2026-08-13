import { buildBreadcrumbListJsonLd, buildPartSlugId, CATEGORY_TREE, slugify } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrandBySlug, useBrandParts } from '@/features/catalog/api/useBrandPage'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/** /brand/:brandSlug (Phase 22 requirement 1) — first version, see useBrandParts.ts's header comment on scope (master-part cards, not live seller offers). */
export default function BrandPage() {
  const { t } = useTranslation()
  const { brandSlug } = useParams()
  const brandQuery = useBrandBySlug(brandSlug)
  const brand = brandQuery.data
  const partsQuery = useBrandParts(brand?.name)

  const path = `/brand/${brandSlug}`
  const canonicalUrl = `${window.location.origin}${path}`
  const title = brand ? `${brand.name} Parts — SnapSpare` : 'SnapSpare'
  const description = brand
    ? `Browse ${brand.name} auto parts across every category on SnapSpare — compare verified sellers, priced by the quantity you actually need.`
    : undefined
  const breadcrumbJsonLd = brand
    ? buildBreadcrumbListJsonLd([
        { name: t('nav.categories'), url: `${window.location.origin}/categories` },
        { name: brand.name, url: canonicalUrl },
      ])
    : null

  useSeoTags({
    title,
    description,
    path,
    ogImage: brand?.logoUrl,
    noindex: !brand,
    jsonLd: [breadcrumbJsonLd],
  })

  if (brandQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-16 w-1/3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (brandQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState onRetry={() => brandQuery.refetch()} />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <EmptyState title={t('store.notFoundTitle')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-3">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-[6px] object-contain" />
        ) : null}
        <h1 className="font-heading text-2xl font-semibold text-ink">{brand.name}</h1>
      </div>

      {partsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : partsQuery.isError ? (
        <ErrorState onRetry={() => partsQuery.refetch()} />
      ) : !partsQuery.data || partsQuery.data.length === 0 ? (
        <EmptyState title={t('store.emptyTitle')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {partsQuery.data.map((part) => {
            const category = CATEGORY_TREE.find((c) => c.slug === part.categorySlug)
            return (
              <Link
                key={part.id}
                to={`/parts/p/${buildPartSlugId(part.slug ?? slugify(part.name), part.id)}`}
                className="flex flex-col gap-1 rounded-[6px] border border-steel/20 bg-surface p-3 hover:bg-surface-muted"
              >
                <p className="line-clamp-2 text-sm font-medium text-ink">{part.name}</p>
                <p className="font-mono text-xs text-steel">{part.partNumber}</p>
                {category ? <p className="text-xs text-steel">{category.name}</p> : null}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
