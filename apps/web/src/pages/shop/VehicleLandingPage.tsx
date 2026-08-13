import { buildBreadcrumbListJsonLd, CATEGORY_TREE } from '@snapspare/shared'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useVehicleLanding } from '@/features/catalog/api/useVehicleLanding'
import { track } from '@/lib/analytics/track'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/**
 * /vehicle/:makeSlug/:modelSlug/:year (Phase 22 requirement 1) — a hub page
 * for "<make> <model> <year>" queries, one level above the finer-grained
 * long-tail landing pages (category × vehicle, e.g. "brake pads for Swift")
 * which reuse the existing vehicle-scoped CategoryPage instead — see that
 * page and functions/src/marketing/generateSeoLandingPages.ts. This page's
 * job is breadth: every active model×year gets one of these, each one
 * linking out to every category's vehicle-scoped CategoryPage, building the
 * internal-link graph crawlers need to discover those finer pages at all.
 */
export default function VehicleLandingPage() {
  const { t } = useTranslation()
  const { makeSlug, modelSlug, year } = useParams()
  const navigate = useNavigate()
  const landingQuery = useVehicleLanding(makeSlug, modelSlug, year)
  const data = landingQuery.data

  useEffect(() => {
    if (data) {
      track('vehicle_selected', {
        vehicleModelId: data.model.id,
        makeName: data.make.name,
        modelName: data.model.name,
        source: 'manual',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per resolved model, not on every query refetch
  }, [data?.model.id])

  const title = data ? `${data.make.name} ${data.model.name} ${year ?? ''} — Parts & Accessories — SnapSpare`.trim() : 'SnapSpare'
  const description = data
    ? `Shop genuine and aftermarket parts for the ${data.make.name} ${data.model.name}${year ? ` (${year})` : ''} — compare prices across verified sellers with quantity-slab pricing.`
    : undefined
  const path = `/vehicle/${makeSlug}/${modelSlug}/${year}`
  const canonicalUrl = `${window.location.origin}${path}`
  const breadcrumbJsonLd = data
    ? buildBreadcrumbListJsonLd([
        { name: t('nav.categories'), url: `${window.location.origin}/categories` },
        { name: `${data.make.name} ${data.model.name}`, url: canonicalUrl },
      ])
    : null

  useSeoTags({
    title,
    description,
    path,
    noindex: !data || data.yearInRange === false,
    jsonLd: [breadcrumbJsonLd],
  })

  if (landingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (landingQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState onRetry={() => landingQuery.refetch()} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <EmptyState
          title={t('category.notFound')}
          actionLabel={t('nav.categories')}
          onAction={() => navigate('/categories')}
        />
      </div>
    )
  }

  const { make, model } = data
  const vehicleSlug = `${make.slug}-${model.slug}`

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-steel">
        <Link to="/categories" className="hover:text-ink">
          {t('nav.categories')}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">
          {make.name} {model.name}
        </span>
      </nav>

      <h1 className="font-heading text-2xl font-semibold text-ink">
        {t('vehicleSelector.landingTitle', { vehicle: `${make.name} ${model.name}${year ? ` (${year})` : ''}` })}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORY_TREE.map((category) => (
          <Link
            key={category.slug}
            to={`/parts/${category.slug}/all/${vehicleSlug}`}
            className="min-h-tap rounded-[6px] border border-steel/20 bg-surface px-3 py-3 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
