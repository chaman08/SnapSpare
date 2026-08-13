import { useTranslation } from 'react-i18next'
import { CreditApprovalsPanel } from '@/features/credit/components/CreditApprovalsPanel'

/** Admin console: Khata credit-limit approval queue (design brief item 7). */
export default function AdminCreditApprovalsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.creditApprovals')}</h1>
      <CreditApprovalsPanel />
    </div>
  )
}
