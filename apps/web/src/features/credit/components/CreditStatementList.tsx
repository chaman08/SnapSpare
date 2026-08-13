import type { CreditStatement, CreditStatementStatus } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_STYLE: Record<CreditStatementStatus, string> = {
  due: 'text-steel',
  paid: 'text-verify',
  overdue: 'text-alert',
}

interface CreditStatementListProps {
  statements: CreditStatement[]
  loading: boolean
}

export function CreditStatementList({ statements, loading }: CreditStatementListProps) {
  const { t } = useTranslation()

  if (loading) return <Skeleton className="h-32 w-full" />
  if (statements.length === 0) {
    return <EmptyState title={t('khata.noStatements')} description={t('khata.noStatementsDescription')} />
  }

  return (
    <ul className="space-y-2">
      {statements.map((statement) => (
        <li key={statement.id} className="flex items-center justify-between rounded-[6px] border border-steel/20 p-3 text-sm">
          <div>
            <p className="text-ink">
              {new Date(statement.periodFrom).toLocaleDateString()} – {new Date(statement.periodTo).toLocaleDateString()}
            </p>
            <p className="text-xs text-steel">
              {t('khata.dueOn', { date: new Date(statement.dueDate).toLocaleDateString() })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-ink">{formatINR(statement.amountDuePaise)}</p>
            <p className={`text-xs font-medium uppercase ${STATUS_STYLE[statement.status]}`}>
              {t(`khata.statementStatus.${statement.status}`)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
