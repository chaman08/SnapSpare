import type { BillingDetails, CheckoutPaymentMethod, SellerServiceability } from '@snapspare/shared'
import { gstinSchema } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddresses } from '@/features/auth/api/addresses'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapPriceCartErrorToI18nKey, usePriceCart } from '@/features/cart/api/priceCart'
import { useCart } from '@/features/cart/api/useCart'
import { createOrder, mapCreateOrderErrorToI18nKey } from '@/features/checkout/api/createOrder'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'
import { useCreditAccount } from '@/features/checkout/api/useCreditAccount'
import { BillingSection } from '@/features/checkout/components/BillingSection'
import { CheckoutOrderSummary } from '@/features/checkout/components/CheckoutOrderSummary'
import { CollapsibleSection } from '@/features/checkout/components/CollapsibleSection'
import { DeliverySection } from '@/features/checkout/components/DeliverySection'
import { PaymentSection } from '@/features/checkout/components/PaymentSection'
import { payWithRazorpay } from '@/features/checkout/lib/payWithRazorpay'
import { generateIdempotencyKey } from '@/features/checkout/lib/razorpay'
import { useDebouncedValue } from '@/features/search/lib/useDebouncedValue'

const PRICE_DEBOUNCE_MS = 350

type SectionKey = 'delivery' | 'billing' | 'payment'

/**
 * Single-page checkout (Phase 8): three collapsible sections (Delivery,
 * Billing & GST, Payment) over one server-priced order summary. Every
 * figure shown comes from priceCart's response, exactly like the cart page —
 * this screen never computes a payable amount itself. "Place order" calls
 * createOrder (which re-runs pricing + reserves stock server-side), then for
 * the Razorpay path opens Standard Checkout and calls confirmPayment — but
 * the webhook remains the authoritative confirmation regardless of what
 * happens in this tab (see functions/src/checkout/paymentTransition.ts).
 */
export default function CheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { sellerGroups, couponCode, loading: cartLoading } = useCart(user?.uid)
  const { addresses } = useAddresses(user?.uid)
  const { config } = useAppConfig()
  const { creditAccount } = useCreditAccount(user?.uid)

  const [openSection, setOpenSection] = useState<SectionKey>('delivery')
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined)
  const [billing, setBilling] = useState<BillingDetails>({ isBusinessPurchase: false })
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay')
  const [serviceabilityResults, setServiceabilityResults] = useState<SellerServiceability[]>([])
  const [placing, setPlacing] = useState(false)

  const flatItems = useMemo(() => sellerGroups.flatMap((group) => group.items), [sellerGroups])
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId)

  const priceCartArgs = useMemo(() => {
    if (flatItems.length === 0) return null
    return {
      items: flatItems.map((item) => ({ listingId: item.listingId, qty: item.qty })),
      couponCode,
      pincode: selectedAddress?.pincode,
      buyerType: profile?.buyerType,
    }
  }, [flatItems, couponCode, selectedAddress?.pincode, profile?.buyerType])
  const debouncedArgs = useDebouncedValue(priceCartArgs, PRICE_DEBOUNCE_MS)
  const priceQuery = usePriceCart(debouncedArgs)

  const sellerNamesById = useMemo(() => {
    const map = new Map<string, string>()
    priceQuery.data?.sellerGroups.forEach((group) => map.set(group.sellerId, group.sellerName))
    return map
  }, [priceQuery.data])

  const totalBeforeCodFeePaise = priceQuery.data?.totalPaise ?? 0
  const codFeePaise = config?.codFeePaise ?? 0

  const allServiceable = serviceabilityResults.length > 0 && serviceabilityResults.every((result) => result.serviceable)
  const hasOversizedCodRestriction = priceQuery.data?.sellerGroups.some((group) => group.codRestricted) ?? false
  const codEligible =
    Boolean(config?.codEnabled) &&
    !profile?.codAbuseFlag &&
    !hasOversizedCodRestriction &&
    (config?.codCapPaise === undefined || totalBeforeCodFeePaise + codFeePaise <= config.codCapPaise) &&
    serviceabilityResults.length > 0 &&
    serviceabilityResults.every((result) => result.codAvailable)
  const codIneligibleReason = profile?.codAbuseFlag
    ? ('abuse_flag' as const)
    : config && !config.codEnabled
      ? ('disabled' as const)
      : hasOversizedCodRestriction
        ? ('oversized' as const)
        : config?.codCapPaise !== undefined && totalBeforeCodFeePaise + codFeePaise > config.codCapPaise
          ? ('over_cap' as const)
          : ('seller_unsupported' as const)

  const creditEligible = Boolean(
    creditAccount && creditAccount.status === 'active' && creditAccount.availableCreditPaise >= totalBeforeCodFeePaise,
  )
  const emiEnabled = config?.emiThresholdPaise !== undefined && totalBeforeCodFeePaise >= config.emiThresholdPaise

  const gstinValid = !billing.isBusinessPurchase || (Boolean(billing.gstin) && gstinSchema.safeParse(billing.gstin).success)
  const billingComplete = !billing.isBusinessPurchase || (gstinValid && Boolean(billing.legalName))
  const deliveryComplete = Boolean(selectedAddressId) && allServiceable

  const canPlaceOrder =
    Boolean(priceQuery.data) &&
    deliveryComplete &&
    billingComplete &&
    priceQuery.data?.unavailableListingIds.length === 0 &&
    !priceQuery.isFetching

  async function handlePlaceOrder() {
    if (!user || !selectedAddressId || !priceQuery.data) return
    setPlacing(true)
    try {
      const orderResult = await createOrder({
        idempotencyKey: generateIdempotencyKey(),
        items: flatItems.map((item) => ({ listingId: item.listingId, qty: item.qty })),
        couponCode,
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

      if (orderResult.paymentMethod === 'razorpay' && orderResult.razorpay) {
        try {
          await payWithRazorpay({
            orderId: orderResult.orderId,
            razorpayOrderId: orderResult.razorpay.gatewayOrderId,
            amountPaise: orderResult.razorpay.amountPaise,
            keyId: orderResult.razorpay.keyId,
            buyerName: profile?.displayName,
            buyerPhone: profile?.phone,
            buyerEmail: profile?.email,
            emiEnabled,
          })
        } catch {
          // Dismissed or failed client-side — the order stays pending_payment
          // and is resumable from the order page/resume-payment banner. The
          // webhook is what actually reconciles a payment that did land.
          toast.error(t('checkout.errors.paymentNotCompleted'))
        }
      }

      navigate(`/orders/${orderResult.orderId}?placed=1`)
    } catch (error) {
      toast.error(t(mapCreateOrderErrorToI18nKey(error)))
    } finally {
      setPlacing(false)
    }
  }

  if (cartLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState message={t('checkout.errors.signInRequired')} onRetry={() => navigate('/login')} />
      </div>
    )
  }

  if (flatItems.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          title={t('cart.emptyTitle')}
          description={t('cart.emptyDescription')}
          actionLabel={t('checkout.continueShopping')}
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('checkout.title')}</h1>

      {priceQuery.isError ? (
        <p role="alert" className="text-sm text-alert">
          {t(mapPriceCartErrorToI18nKey(priceQuery.error))}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <CollapsibleSection
            step={1}
            title={t('checkout.sections.delivery')}
            summary={
              selectedAddress
                ? `${selectedAddress.line1}, ${selectedAddress.city} ${selectedAddress.pincode}`
                : undefined
            }
            complete={deliveryComplete}
            open={openSection === 'delivery'}
            onToggle={() => setOpenSection('delivery')}
          >
            <DeliverySection
              userId={user.uid}
              sellerNamesById={sellerNamesById}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              onServiceabilityChange={setServiceabilityResults}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-signal disabled:opacity-40"
                disabled={!deliveryComplete}
                onClick={() => setOpenSection('billing')}
              >
                {t('checkout.continue')}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            step={2}
            title={t('checkout.sections.billing')}
            summary={billing.isBusinessPurchase ? billing.gstin : t('checkout.billing.personalPurchase')}
            complete={billingComplete}
            open={openSection === 'billing'}
            onToggle={() => setOpenSection('billing')}
          >
            <BillingSection userId={user.uid} value={billing} onChange={setBilling} />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-signal disabled:opacity-40"
                disabled={!billingComplete}
                onClick={() => setOpenSection('payment')}
              >
                {t('checkout.continue')}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            step={3}
            title={t('checkout.sections.payment')}
            summary={t(`checkout.payment.methodLabel.${paymentMethod}`)}
            complete
            open={openSection === 'payment'}
            onToggle={() => setOpenSection('payment')}
          >
            <PaymentSection
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              codEligible={codEligible}
              codIneligibleReason={codIneligibleReason}
              codFeePaise={codFeePaise}
              creditEligible={creditEligible}
              creditAvailablePaise={creditAccount?.availableCreditPaise}
              emiEnabled={emiEnabled}
            />
          </CollapsibleSection>
        </div>

        <div>
          {priceQuery.data ? (
            <CheckoutOrderSummary
              result={priceQuery.data}
              codFeePaise={paymentMethod === 'cod' ? codFeePaise : 0}
              onPlaceOrder={handlePlaceOrder}
              placing={placing}
              disabled={!canPlaceOrder}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </div>
      </div>
    </div>
  )
}
