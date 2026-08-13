import type { CreditAccount } from '@snapspare/shared'
import { formatINR, toPaise } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCreditRepaymentLink } from '@/features/credit/api/creditActions'

interface KhataOverviewCardProps {
  account: CreditAccount
}

/** Credit account balance panel + "repay now" flow — creates a Razorpay Payment Link and opens it, which (once paid) credits the account via the payment.captured webhook (design brief item 7). */
export function KhataOverviewCard({ account }: KhataOverviewCardProps) {
  const { t } = useTranslation()
  const [repayAmount, setRepayAmount] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)

  async function handleRepay() {
    const rupees = Number(repayAmount)
    if (!Number.isFinite(rupees) || rupees <= 0) return
    setCreatingLink(true)
    try {
      const result = await createCreditRepaymentLink({ amountPaise: toPaise(rupees) })
      window.open(result.shortUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('khata.repayFailed'))
    } finally {
      setCreatingLink(false)
    }
  }

  return (
    <div className="rounded-[6px] border border-steel/20 bg-white p-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-steel">{t('khata.limit')}</p>
          <p className="font-mono text-lg font-semibold text-ink">{formatINR(account.creditLimitPaise)}</p>
        </div>
        <div>
          <p className="text-xs text-steel">{t('khata.used')}</p>
          <p className="font-mono text-lg font-semibold text-alert">{formatINR(account.outstandingPaise)}</p>
        </div>
        <div>
          <p className="text-xs text-steel">{t('khata.available')}</p>
          <p className="font-mono text-lg font-semibold text-verify">{formatINR(account.availableCreditPaise)}</p>
        </div>
      </div>

      {account.status !== 'active' ? (
        <p className="mt-3 rounded-[6px] bg-alert/10 p-2 text-center text-sm text-alert">
          {t(account.status === 'suspended' ? 'khata.suspended' : 'khata.closed')}
        </p>
      ) : null}

      {account.outstandingPaise > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-steel/10 pt-4">
          <div className="flex-1">
            <label htmlFor="repay-amount" className="text-xs text-steel">
              {t('khata.repayAmount')}
            </label>
            <Input
              id="repay-amount"
              type="number"
              min={1}
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button type="button" variant="cta" disabled={creatingLink || !repayAmount} onClick={() => void handleRepay()}>
            {creatingLink ? t('common.loading') : t('khata.repayNow')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
