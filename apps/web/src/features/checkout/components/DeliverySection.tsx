import type { SellerServiceability } from '@snapspare/shared'
import { CheckCircle2, MapPin, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { addAddress, useAddresses } from '@/features/auth/api/addresses'
import { AddressFormPanel } from '@/features/auth/components/AddressFormPanel'
import { useServiceability } from '@/features/checkout/api/checkServiceability'
import { cn } from '@/lib/utils'

function ServiceabilityRow({ result, sellerName }: { result: SellerServiceability; sellerName: string }) {
  const { t } = useTranslation()
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-[6px] px-3 py-2 text-sm',
        result.serviceable ? 'bg-verify/5 text-verify' : 'bg-alert/5 text-alert',
      )}
    >
      {result.serviceable ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="flex-1">
        {sellerName || t('checkout.delivery.thisSeller')}
        {result.serviceable && result.etaDaysMin !== undefined && result.etaDaysMax !== undefined
          ? ` — ${t('cart.deliveryEtaRange', { min: result.etaDaysMin, max: result.etaDaysMax })}`
          : null}
        {!result.serviceable ? ` — ${t('checkout.delivery.notServiceable')}` : null}
      </span>
    </li>
  )
}

interface DeliverySectionProps {
  userId: string
  sellerNamesById: Map<string, string>
  selectedAddressId: string | undefined
  onSelectAddress: (addressId: string) => void
  onServiceabilityChange?: (results: SellerServiceability[]) => void
}

/**
 * Checkout section 1 (design spec): address book selection, add-new inline,
 * and a per-seller pincode serviceability check the moment an address is
 * picked — so an unshippable seller surfaces here, not after payment.
 */
export function DeliverySection({
  userId,
  sellerNamesById,
  selectedAddressId,
  onSelectAddress,
  onServiceabilityChange,
}: DeliverySectionProps) {
  const { t } = useTranslation()
  const { addresses, loading } = useAddresses(userId)
  const [addingNew, setAddingNew] = useState(false)

  const sellerIds = Array.from(sellerNamesById.keys())
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  const serviceabilityArgs =
    selectedAddress && sellerIds.length > 0 ? { pincode: selectedAddress.pincode, sellerIds } : null
  const serviceabilityQuery = useServiceability(serviceabilityArgs)

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return
    const fallback = addresses.find((a) => a.isDefault) ?? addresses[0]
    if (fallback) onSelectAddress(fallback.id)
  }, [addresses, selectedAddressId, onSelectAddress])

  useEffect(() => {
    if (!serviceabilityQuery.data || !onServiceabilityChange) return
    onServiceabilityChange(serviceabilityQuery.data.results)
  }, [serviceabilityQuery.data, onServiceabilityChange])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (addingNew || addresses.length === 0) {
    return (
      <AddressFormPanel
        onCancel={() => setAddingNew(false)}
        onSubmit={async (input) => {
          const newId = await addAddress(userId, input)
          toast.success(t('address.saved'))
          setAddingNew(false)
          onSelectAddress(newId)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        name="shippingAddress"
        aria-label={t('checkout.delivery.selectAddress')}
        value={selectedAddressId ?? ''}
        onValueChange={onSelectAddress}
        className="space-y-2"
      >
        {addresses.map((address) => (
          <RadioGroupItem key={address.id} value={address.id}>
            <span className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">
                  {address.label}
                  {address.isDefault ? (
                    <span className="ml-2 text-xs text-verify">{t('address.default')}</span>
                  ) : null}
                </span>
                <span className="block text-sm text-steel">
                  {address.contactName} · {address.contactPhone}
                </span>
                <span className="block text-sm text-steel">
                  {address.line1}, {address.city}, {address.state} {address.pincode}
                </span>
              </span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>

      <Button type="button" variant="outline" size="sm" onClick={() => setAddingNew(true)}>
        {t('address.add')}
      </Button>

      {selectedAddress && sellerIds.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t('checkout.delivery.serviceabilityTitle')}</p>
          {serviceabilityQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : serviceabilityQuery.isError ? (
            <p role="alert" className="text-sm text-alert">
              {t('checkout.errors.serviceabilityFailed')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {serviceabilityQuery.data?.results.map((result) => (
                <ServiceabilityRow
                  key={result.sellerId}
                  result={result}
                  sellerName={sellerNamesById.get(result.sellerId) ?? ''}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
