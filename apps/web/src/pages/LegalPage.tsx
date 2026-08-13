import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { CmsBody } from '@/features/legal/components/CmsBody'
import { useCmsPageBySlug } from '@/features/legal/api/useCmsPageBySlug'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/**
 * Phase 24 (launch readiness): public renderer for every seeded legal page
 * (Terms of Use, Seller Agreement, Privacy Policy, Return & Refund,
 * Shipping, Cancellation, Grievance Redressal — see
 * packages/seed/src/seeders/seedLegalContent.ts) at `/legal/:slug`. Reuses
 * the Phase 19 `cmsPages` collection/schema rather than a separate legal-
 * content system — the admin CMS panel can already edit these pages.
 */
export default function LegalPage() {
  const { t, i18n } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const language = i18n.language === 'hi' ? 'hi' : 'en'
  const pageQuery = useCmsPageBySlug(slug)
  const page = pageQuery.data

  useSeoTags({
    title: page ? `${page.title[language]} — SnapSpare` : 'SnapSpare',
    description: page?.metaDescription?.[language] ?? '',
    path: `/legal/${slug}`,
    noindex: !page,
  })

  if (pageQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState title={t('legal.notFoundTitle')} description={t('legal.notFoundDescription')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{page.title[language]}</h1>
      <CmsBody text={page.body[language]} />
    </div>
  )
}
