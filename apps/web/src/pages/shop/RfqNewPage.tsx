import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { RfqForm } from '@/features/rfq/components/RfqForm'

/** Standalone /rfq/new entry point (requirement 1). Optional ?description=&categorySlug= prefill from a deep link. */
export default function RfqNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('rfq.new.title')}</h1>
      <p className="text-sm text-steel">{t('rfq.new.description')}</p>
      <RfqForm
        defaultDescription={searchParams.get('description') ?? undefined}
        defaultCategorySlug={searchParams.get('categorySlug') ?? undefined}
        onCreated={(result) => navigate(`/rfq/${result.rfqId}`)}
      />
    </div>
  )
}
