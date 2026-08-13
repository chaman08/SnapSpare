import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { CmsBody } from '@/features/legal/components/CmsBody'
import { useFaqArticles } from '@/features/legal/api/useCmsPageBySlug'
import { useSeoTags } from '@/lib/seo/useSeoTags'
import { cn } from '@/lib/utils'

/**
 * Phase 24 (launch readiness): Help Centre — an accordion over every
 * published `cmsPages` doc of type `faq` (seedLegalContent.ts seeds a
 * starter set). Links out to /support for anything an article doesn't
 * answer, and to the legal pages for policy-level detail.
 */
export default function HelpCentrePage() {
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'hi' ? 'hi' : 'en'
  const articlesQuery = useFaqArticles()
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  useSeoTags({
    title: `${t('help.title')} — SnapSpare`,
    description: t('help.metaDescription'),
    path: '/help',
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('help.title')}</h1>
        <p className="mt-1 text-sm text-steel">{t('help.subtitle')}</p>
      </div>

      {articlesQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : articlesQuery.isError ? (
        <ErrorState onRetry={() => articlesQuery.refetch()} />
      ) : !articlesQuery.data || articlesQuery.data.length === 0 ? (
        <EmptyState title={t('help.emptyTitle')} />
      ) : (
        <ul className="divide-y divide-steel/10 rounded-[6px] border border-steel/20 bg-surface">
          {articlesQuery.data.map((article) => {
            const isOpen = openSlug === article.slug
            return (
              <li key={article.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                  onClick={() => setOpenSlug(isOpen ? null : article.slug)}
                >
                  <span className="text-sm font-medium text-ink">{article.title[language]}</span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-steel transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <div className="px-4 pb-4">
                    <CmsBody text={article.body[language]} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-[6px] border border-steel/20 bg-surface-muted p-4 text-sm text-ink">
        <p>{t('help.stillNeedHelp')}</p>
        <Link to="/support" className="mt-1 inline-block font-medium text-signal hover:underline">
          {t('help.contactSupportLink')}
        </Link>
      </div>
    </div>
  )
}
