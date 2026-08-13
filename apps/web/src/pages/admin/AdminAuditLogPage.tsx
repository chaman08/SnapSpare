import { useTranslation } from 'react-i18next'
import { AuditLogTable } from '@/features/admin/components/AuditLogTable'

export default function AdminAuditLogPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.auditLog')}</h1>
      <AuditLogTable />
    </div>
  )
}
