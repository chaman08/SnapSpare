import type { BillingDetails, CheckoutPaymentMethod, Rfq, RfqQuote, SellerServiceability } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'
import { useCreditAccount } from '@/features/checkout/api/useCreditAccount'
import { BillingSection } from '@/features/checkout/components/BillingSection'
import { DeliverySection } from '@/features/checkout/components/DeliverySection'
import { PaymentSection } from '@/features/checkout/components/PaymentSection'
import { payWithRazorpay } from '@/features/checkout/lib/payWithRazorpay'
import { generateIdempotencyKey } from '@/features/checkout/lib/razorpay'
import { acceptRfqQuote, mapRfqErrorToI18nKey } from '@/features/rfq/api/rfqActions'
import { estimateLandedCost } from '@/features/rfq/lib/landedCost'

interface AcceptRfqQuoteDialogProps {
  rfq: Rfq
  quote: RfqQuote | null
  onClose: () => void
}

/**
 * Requirement 4's "Accept converts the quote into a normal order" — reuses
 * checkout's DeliverySection/PaymentSection/payWithRazorpay exactly as
 * CheckoutPage does (single-seller version of the same flow), since an RFQ
 * acceptance is a real order placement with the same address/payment/billing
 * decisions, just against one negotiated line instead of a priced cart.
 */
export function AcceptRfqQuoteDialog({ rfq, quote, onClose }: AcceptRfqQuoteDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { config } = useAppConfig()
  const { creditAccount } = useCreditAccount(user?.uid)

  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined)
  const [billing, setBilling] = useState<BillingDetails>({ isBusinessPurchase: false })
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay')
  const [serviceabilityResults, setServiceabilityResults] = useState<SellerServiceability[]>([])
  const [accepting, setAccepting] = useState(false)

  const sellerNamesById = useMemo(() => {
    const map = new Map<string, string>()
    if (quote) map.set(quote.sellerId, quote.sellerName)
    return map
  }, [quote])

  const estimate = quote ? estimateLandedCost(quote) : null
  const totalForEligibility = estimate?.totalEstimatePaise ?? estimate?.subtotalPaise ?? 0
  const codFeePaise = config?.codFeePaise ?? 0

  const allServiceable = serviceabilityResults.length > 0 && serviceabilityResults.every((r) => r.serviceable)
  const codEligible =
    Boolean(config?.codEnabled) &&
    !profile?.codAbuseFlag &&
    (config?.codCapPaise === undefined || totalForEligibility + codFeePaise <= config.codCapPaise) &&
    serviceabilityResults.length > 0 &&
    serviceabilityResults.every((r) => r.codAvailable)
  const creditEligible = Boolean(
    creditAccount && creditAccount.status === 'active' && creditAccount.availableCreditPaise >= totalForEligibility,
  )
  const gstinValid = !billing.isBusinessPurchase || Boolean(billing.gstin) && Boolean(billing.legalName)
  const canAccept = Boolean(selectedAddressId) && allServiceable && gstinValid && !accepting

  async function handleAccept() {
    if (!quote || !selectedAddressId) return
    setAccepting(true)
    try {
      const result = await acceptRfqQuote({
        idempotencyKey: generateIdempotencyKey(),
        rfqId: rfq.id,
        quoteId: quote.id,
        shippingAddressId: selectedAddressId,
        billing: billing.isBusinessPurchase
          ? {
              isBusinessPurchase: true,
              gstin: billing.gstin || undefined,
              legalName: billing.legalName || undefined,
              billingAddressId: billing.billingAddressId,
            }
          : undefined,
        paymentMethod,
      })

      if (result.paymentMethod === 'razorpay' && result.razorpay) {
        try {
          await payWithRazorpay({
            orderId: result.orderId,
            razorpayOrderId: result.razorpay.gatewayOrderId,
            amountPaise: result.razorpay.amountPaise,
            keyId: result.razorpay.keyId,
            buyerName: profile?.displayName,
            buyerPhone: profile?.phone,
            buyerEmail: profile?.email,
            emiEnabled: false,
          })
        } catch {
          toast.error(t('checkout.errors.paymentNotCompleted'))
        }
      }

      toast.success(t('rfq.accept.success'))
      navigate(`/orders/${result.orderId}?placed=1`)
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Dialog open={Boolean(quote)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rfq.accept.title')}</DialogTitle>
        </DialogHeader>

        {quote && user ? (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto">
            <div className="rounded-[6px] border border-steel/20 bg-surface-muted p-3 text-sm">
              <p className="font-medium text-ink">{quote.sellerName}</p>
              <p className="text-steel">
                {t('rfq.accept.lineSummary', { qty: quote.qtyOffered, price: formatINR(quote.unitPricePaise) })}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t('checkout.sections.delivery')}</p>
              <DeliverySection
                userId={user.uid}
                sellerNamesById={sellerNamesById}
                selectedAddressId={selectedAddressId}
                onSelectAddress={setSelectedAddressId}
                onServiceabilityChange={setServiceabilityResults}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t('checkout.sections.billing')}</p>
              <BillingSection userId={user.uid} value={billing} onChange={setBilling} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t('checkout.sections.payment')}</p>
              <PaymentSection
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                codEligible={codEligible}
                codFeePaise={codFeePaise}
                creditEligible={creditEligible}
                creditAvailablePaise={creditAccount?.availableCreditPaise}
                emiEnabled={false}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={accepting}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="cta" onClick={handleAccept} disabled={!canAccept}>
            {accepting ? t('common.loading') : t('rfq.accept.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
