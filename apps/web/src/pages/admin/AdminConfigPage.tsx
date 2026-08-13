import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'

/** Config module (design brief item 12) — not built this pass; see the Phase 19 summary's left-out list. Routed so /admin/config doesn't 404. */
export default function AdminConfigPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">{t('admin.nav.config')}</h1>
      <EmptyState title={t('admin.config.comingSoonTitle')} description={t('admin.config.comingSoonDescription')} />
    </div>
  )
}
