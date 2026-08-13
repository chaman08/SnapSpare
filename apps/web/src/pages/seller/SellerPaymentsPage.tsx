import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useLedger } from '@/features/seller/api/useLedger'
import { usePayouts } from '@/features/seller/api/usePayouts'
import { LedgerBalanceCard } from '@/features/seller/components/LedgerBalanceCard'
import { PayoutHistoryPanel } from '@/features/seller/components/PayoutHistoryPanel'

/** Seller-console payments home (design brief item 6): current balance, upcoming payout, payout history with downloadable statements, and a per-order money breakdown. */
export default function SellerPaymentsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId

  const { ledger, entries, loading: ledgerLoading } = useLedger(sellerId)
  const { payouts, loading: payoutsLoading } = usePayouts(sellerId)
  const upcomingPayout = payouts.find((p) => p.status === 'pending' || p.status === 'processing')

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerOrders.nav.payments')}</h1>
      <LedgerBalanceCard
        balancePaise={ledger?.currentBalancePaise}
        entries={entries}
        upcomingPayout={upcomingPayout}
        loading={ledgerLoading}
      />
      <PayoutHistoryPanel payouts={payouts} loading={payoutsLoading} />
    </div>
  )
}
