import { useTranslation } from 'react-i18next'
import { UsersTable } from '@/features/admin/components/UsersTable'

export default function AdminUsersPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.users')}</h1>
      <UsersTable />
    </div>
  )
}
