import type { SellerDailyStats } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'

interface SlaScorecardProps {
  stats: SellerDailyStats[]
  isLoading: boolean
}

function percentOnTime(onTime: number, late: number): number | undefined {
  const total = onTime + late
  return total > 0 ? (onTime / total) * 100 : undefined
}

export function SlaScorecard({ stats, isLoading }: SlaScorecardProps) {
  const { t } = useTranslation()

  const acceptedOnTime = stats.reduce((sum, day) => sum + day.slaAcceptedOnTime, 0)
  const acceptedLate = stats.reduce((sum, day) => sum + day.slaAcceptedLate, 0)
  const packedOnTime = stats.reduce((sum, day) => sum + day.slaPackedOnTime, 0)
  const packedLate = stats.reduce((sum, day) => sum + day.slaPackedLate, 0)

  const acceptPercent = percentOnTime(acceptedOnTime, acceptedLate)
  const packPercent = percentOnTime(packedOnTime, packedLate)

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="sla-scorecard-heading">
      <h2 id="sla-scorecard-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.slaScorecard.title')}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3" aria-live="polite">
        <div>
          <p
            className={`font-mono text-2xl font-semibold ${
              acceptPercent !== undefined && acceptPercent < 90 ? 'text-alert' : 'text-verify'
            }`}
          >
            {isLoading ? '—' : acceptPercent === undefined ? '—' : `${acceptPercent.toFixed(0)}%`}
          </p>
          <p className="text-sm text-steel">{t('sellerDashboard.slaScorecard.acceptOnTime')}</p>
        </div>
        <div>
          <p
            className={`font-mono text-2xl font-semibold ${
              packPercent !== undefined && packPercent < 90 ? 'text-alert' : 'text-verify'
            }`}
          >
            {isLoading ? '—' : packPercent === undefined ? '—' : `${packPercent.toFixed(0)}%`}
          </p>
          <p className="text-sm text-steel">{t('sellerDashboard.slaScorecard.packOnTime')}</p>
        </div>
      </div>
    </section>
  )
}
