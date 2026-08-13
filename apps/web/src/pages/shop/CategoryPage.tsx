import { buildBreadcrumbListJsonLd, buildFaqPageJsonLd, CATEGORY_TREE } from '@snapspare/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { useSeoLandingPage } from '@/features/catalog/api/useSeoLandingPage'
import { useResolveVehicleFromSlug } from '@/features/search/api/useResolveVehicleFromSlug'
import { SearchResultsGrid } from '@/features/search/components/SearchResultsGrid'
import { EMPTY_SEARCH_FILTERS, type SearchFilters, type SearchSortOption } from '@/features/search/types'
import { track } from '@/lib/analytics/track'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/**
 * Category browse page — SEO-friendly URLs:
 *   /parts/:categorySlug
 *   /parts/:categorySlug/:subCategorySlug
 *   /parts/:categorySlug/:subCategorySlug/:vehicleSlug  (vehicle-scoped variant)
 * All three map to this one component (see router.tsx) rather than relying
 * on react-router's optional-segment syntax, so the route table stays
 * unambiguous to read.
 */
export default function CategoryPage() {
  const { t } = useTranslation()
  const { categorySlug, subCategorySlug, vehicleSlug } = useParams()
  const vehicleQuery = useResolveVehicleFromSlug(vehicleSlug)
  const seoLandingQuery = useSeoLandingPage(categorySlug, subCategorySlug, vehicleSlug)
  const seoLanding = seoLandingQuery.data
  const navigate = useNavigate()

  const category = CATEGORY_TREE.find((c) => c.slug === categorySlug)
  const subCategory = category?.subcategories.find((s) => s.slug === subCategorySlug)

  useEffect(() => {
    if (vehicleQuery.data) {
      track('vehicle_selected', {
        vehicleModelId: vehicleQuery.data.model.id,
        makeName: vehicleQuery.data.make.name,
        modelName: vehicleQuery.data.model.name,
        source: 'manual',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per resolved vehicle, not on every query refetch
  }, [vehicleQuery.data?.model.id])

  const [filters, setFilters] = useState<SearchFilters>({
    ...EMPTY_SEARCH_FILTERS,
    category: categorySlug,
    subCategory: subCategorySlug,
  })
  const [sort, setSort] = useState<SearchSortOption>('relevance')

  useEffect(() => {
    setFilters((prev) => ({ ...prev, category: categorySlug, subCategory: subCategorySlug }))
  }, [categorySlug, subCategorySlug])

  useEffect(() => {
    const resolved = vehicleQuery.data
    if (resolved) {
      setFilters((prev) => ({ ...prev, vehicleModelId: resolved.model.id, fitsMyVehicle: true }))
    }
  }, [vehicleQuery.data])

  const path = `/parts/${categorySlug}${subCategorySlug ? `/${subCategorySlug}` : ''}${vehicleSlug ? `/${vehicleSlug}` : ''}`
  const pageTitle = seoLanding?.title ?? (category ? `${subCategory?.name ?? category.name} — SnapSpare` : 'SnapSpare')
  const pageDescription =
    seoLanding?.metaDescription ??
    (category
      ? `Shop ${subCategory?.name ?? category.name} for every make and model — compare verified sellers with quantity-slab pricing on SnapSpare.`
      : undefined)
  const canonicalUrl = `${window.location.origin}${path}`
  const breadcrumbJsonLd = category
    ? buildBreadcrumbListJsonLd([
        { name: t('nav.categories'), url: `${window.location.origin}/categories` },
        { name: category.name, url: `${window.location.origin}/parts/${category.slug}` },
        ...(subCategory
          ? [{ name: subCategory.name, url: `${window.location.origin}/parts/${category.slug}/${subCategory.slug}` }]
          : []),
        ...(vehicleQuery.data
          ? [{ name: `${vehicleQuery.data.make.name} ${vehicleQuery.data.model.name}`, url: canonicalUrl }]
          : []),
      ])
    : null
  const faqJsonLd = seoLanding ? buildFaqPageJsonLd(seoLanding.faq) : null
  // A vehicle-scoped URL with no matching search-index results yet and no
  // curated landing-page doc is exactly the thin/duplicate-content case
  // Google's guidance warns against indexing — everything else stays indexable.
  const isThinVehiclePage = Boolean(vehicleSlug) && !seoLanding && !seoLandingQuery.isLoading

  useSeoTags({
    title: pageTitle,
    description: pageDescription,
    path,
    noindex: !category || isThinVehiclePage,
    jsonLd: [breadcrumbJsonLd, faqJsonLd],
  })

  if (!category) {
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

  const basePath = subCategorySlug ? `/parts/${categorySlug}/${subCategorySlug}` : `/parts/${categorySlug}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-steel">
        <Link to="/categories" className="hover:text-ink">
          {t('nav.categories')}
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/parts/${categorySlug}`} className="hover:text-ink">
          {category.name}
        </Link>
        {subCategory ? (
          <>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{subCategory.name}</span>
          </>
        ) : null}
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold text-ink">{subCategory?.name ?? category.name}</h1>
        {vehicleQuery.data ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-verify/10 px-3 py-1 text-xs font-medium text-verify">
            {t('category.forVehicle', { vehicle: `${vehicleQuery.data.make.name} ${vehicleQuery.data.model.name}` })}
            <Link to={basePath} className="underline">
              {t('common.close')}
            </Link>
          </span>
        ) : null}
      </div>

      {seoLanding?.introText ? <p className="mb-4 text-sm text-steel">{seoLanding.introText}</p> : null}

      {!subCategorySlug && category.subcategories.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.subcategories.map((sub) => (
            <Link
              key={sub.slug}
              to={`/parts/${categorySlug}/${sub.slug}`}
              className="min-h-tap rounded-full border border-steel/20 px-3 py-1.5 text-sm text-ink hover:bg-surface-muted"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      ) : null}

      <SearchResultsGrid query="" filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} />

      {seoLanding && seoLanding.faq.length > 0 ? (
        <section className="mt-8" aria-labelledby="category-faq-heading">
          <h2 id="category-faq-heading" className="mb-3 font-heading text-lg font-semibold text-ink">
            {t('category.faqTitle')}
          </h2>
          <dl className="space-y-3">
            {seoLanding.faq.map((item) => (
              <div key={item.question}>
                <dt className="text-sm font-medium text-ink">{item.question}</dt>
                <dd className="mt-0.5 text-sm text-steel">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  )
}
