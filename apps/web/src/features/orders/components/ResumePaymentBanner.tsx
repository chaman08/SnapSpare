import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { usePendingOrders } from '@/features/orders/api/usePendingOrders'

/**
 * Persistent "resume payment" banner (design spec): shown app-wide whenever
 * the signed-in buyer has a `pending_payment` order — an abandoned or
 * failed Razorpay checkout, still holding its stock reservation until
 * releaseExpiredReservations expires it. Clicking it goes straight to the
 * order detail page, which has the actual "Pay now" action.
 */
export function ResumePaymentBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pendingOrders } = usePendingOrders(user?.uid)

  const mostRecent = pendingOrders[0]
  if (!mostRecent) return null

  return (
    <button
      type="button"
      onClick={() => navigate(`/orders/${mostRecent.id}`)}
      aria-live="polite"
      className="flex min-h-tap w-full items-center gap-2 bg-alert/10 px-4 py-2 text-left text-sm font-medium text-alert transition-colors hover:bg-alert/15"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{t('orders.resumeBanner', { count: pendingOrders.length })}</span>
      <span className="underline underline-offset-2">{t('orders.resumePayment')}</span>
    </button>
  )
}
