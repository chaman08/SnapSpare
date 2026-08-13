import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useCreditAccount } from '@/features/checkout/api/useCreditAccount'
import { useCreditStatements } from '@/features/credit/api/useCreditStatements'
import { CreditLimitRequestForm } from '@/features/credit/components/CreditLimitRequestForm'
import { CreditStatementList } from '@/features/credit/components/CreditStatementList'
import { KhataOverviewCard } from '@/features/credit/components/KhataOverviewCard'

/** Buyer-facing Khata screen (design brief item 7): credit account balance, statement history, and repayment. Verified garages with no account yet see a request form instead. */
export default function KhataPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const { creditAccount, loading: accountLoading } = useCreditAccount(user?.uid)
  const { statements, loading: statementsLoading } = useCreditStatements(user?.uid)

  const isGarageVerified = profile?.buyerType === 'garage' && Boolean(profile?.garageVerifiedAt)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('khata.title')}</h1>

      {accountLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : creditAccount ? (
        <KhataOverviewCard account={creditAccount} />
      ) : isGarageVerified ? (
        <CreditLimitRequestForm />
      ) : (
        <EmptyState title={t('khata.notEligibleTitle')} description={t('khata.notEligibleDescription')} />
      )}

      {creditAccount ? (
        <div>
          <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{t('khata.statements')}</h2>
          <CreditStatementList statements={statements} loading={statementsLoading} />
        </div>
      ) : null}
    </div>
  )
}
