import type { GstRatePercent, Rfq } from '@snapspare/shared'
import { toPaise } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSellerListings } from '@/features/seller-listings/api/useSellerListings'
import { mapRfqErrorToI18nKey, submitRfqQuote } from '@/features/rfq/api/rfqActions'

const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28]

const formSchema = z.object({
  unitPriceRupees: z.coerce.number().positive(),
  qtyOffered: z.coerce.number().int().positive(),
  moq: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  leadTimeDays: z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
  notes: z.string().max(1000).optional(),
  listingId: z.string().optional(),
  hsnCode: z.string().optional(),
  gstRatePercent: z.coerce.number().optional(),
  validUntil: z.string().min(1),
})
type FormValues = z.infer<typeof formSchema>

interface SellerQuoteBuilderFormProps {
  sellerId: string
  rfq: Rfq
  onSubmitted: () => void
}

/** Requirement 3: seller quote builder — per-line unit price, quantity available (the counter-quantity), lead time, validity date, message, and an optional listing to anchor the quote to. */
export function SellerQuoteBuilderForm({ sellerId, rfq, onSubmitted }: SellerQuoteBuilderFormProps) {
  const { t } = useTranslation()
  const { data: listings } = useSellerListings(sellerId, 'active')
  const needsHsnGst = !rfq.partId

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { qtyOffered: rfq.qtyRequested, validUntil: '', notes: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (needsHsnGst && (!values.hsnCode || values.gstRatePercent === undefined)) {
      toast.error(t('rfq.errors.hsnGstRequired'))
      return
    }
    try {
      await submitRfqQuote({
        rfqId: rfq.id,
        unitPricePaise: toPaise(values.unitPriceRupees),
        qtyOffered: values.qtyOffered,
        moq: values.moq !== '' && values.moq !== undefined ? values.moq : undefined,
        leadTimeDays: values.leadTimeDays !== '' && values.leadTimeDays !== undefined ? values.leadTimeDays : undefined,
        notes: values.notes || undefined,
        listingId: values.listingId || undefined,
        hsnCode: needsHsnGst ? values.hsnCode : undefined,
        gstRatePercent: needsHsnGst ? (values.gstRatePercent as GstRatePercent) : undefined,
        validUntil: new Date(values.validUntil).getTime(),
      })
      toast.success(t('rfq.seller.quoteSubmitted'))
      onSubmitted()
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quote-unitPrice">{t('rfq.seller.unitPrice')}</Label>
          <Input id="quote-unitPrice" type="number" inputMode="decimal" min={0} step="0.01" {...register('unitPriceRupees')} />
          {errors.unitPriceRupees ? (
            <p role="alert" className="text-sm text-alert">
              {t('rfq.seller.unitPriceRequired')}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-qty">{t('rfq.seller.qtyOffered')}</Label>
          <Input id="quote-qty" type="number" inputMode="numeric" min={1} {...register('qtyOffered')} />
          <p className="text-xs text-steel">{t('rfq.seller.counterQtyHint', { requested: rfq.qtyRequested })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quote-moq">{t('rfq.seller.moq')}</Label>
          <Input id="quote-moq" type="number" inputMode="numeric" min={1} {...register('moq')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-leadTime">{t('rfq.seller.leadTimeDays')}</Label>
          <Input id="quote-leadTime" type="number" inputMode="numeric" min={0} {...register('leadTimeDays')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quote-validUntil">{t('rfq.seller.validUntil')}</Label>
        <Input id="quote-validUntil" type="date" {...register('validUntil')} />
        {errors.validUntil ? (
          <p role="alert" className="text-sm text-alert">
            {t('rfq.seller.validUntilRequired')}
          </p>
        ) : null}
      </div>

      {listings && listings.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="quote-listing">{t('rfq.seller.linkListing')}</Label>
          <select
            id="quote-listing"
            {...register('listingId')}
            className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <option value="">{t('rfq.seller.noLinkedListing')}</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title} ({listing.sku})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {needsHsnGst ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quote-hsn">{t('rfq.seller.hsnCode')}</Label>
            <Input id="quote-hsn" className="font-mono" {...register('hsnCode')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-gst">{t('rfq.seller.gstRate')}</Label>
            <select
              id="quote-gst"
              {...register('gstRatePercent')}
              className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="quote-notes">{t('rfq.seller.message')}</Label>
        <textarea
          id="quote-notes"
          rows={2}
          placeholder={t('rfq.seller.messagePlaceholder')}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          {...register('notes')}
        />
      </div>

      <Button type="submit" variant="cta" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('rfq.seller.submitQuote')}
      </Button>
    </form>
  )
}
