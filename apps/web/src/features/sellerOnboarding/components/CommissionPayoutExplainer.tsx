import { IndianRupee, ShieldCheck, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ROWS = [
  { icon: IndianRupee, key: 'commission' },
  { icon: Wallet, key: 'payout' },
  { icon: ShieldCheck, key: 'noHiddenFees' },
] as const

export function CommissionPayoutExplainer() {
  const { t } = useTranslation()

  return (
    <section className="space-y-4 rounded-[6px] border border-steel/20 bg-surface p-5">
      <h2 className="font-heading text-xl font-semibold text-ink">{t('sell.landing.commission.title')}</h2>
      <dl className="space-y-3">
        {ROWS.map(({ icon: Icon, key }) => (
          <div key={key} className="flex gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-verify" aria-hidden="true" />
            <div>
              <dt className="text-sm font-medium text-ink">{t(`sell.landing.commission.${key}Title`)}</dt>
              <dd className="text-sm text-steel">{t(`sell.landing.commission.${key}Description`)}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
