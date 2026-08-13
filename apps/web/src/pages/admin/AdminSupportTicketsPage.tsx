import { useTranslation } from 'react-i18next'
import { SupportTicketsQueue } from '@/features/admin/components/SupportTicketsQueue'

export default function AdminSupportTicketsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.support.title')}</h1>
      <SupportTicketsQueue />
    </div>
  )
}
